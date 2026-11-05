import { Injectable, Logger } from '@nestjs/common';

import type { CreateResearchDto } from './dto/create-research.dto.js';

import { PRODUCT_PROFILE_PROMPT } from './stages/01-product-profile/product-profile.prompt.js';
import { LLM_CONFIG } from './config/llm-config.js';

import { collectPageCandidates } from './stages/04-normalization/collect-page-candidates.js';
import { createProductProfile } from './stages/01-product-profile/create-product-profile.js';
import { createResearchPlan } from './stages/02-research-plan/create-research-plan.js';
import { runSearches } from './stages/03-discovery/run-searches.js';
import { groupPagesBySite } from './stages/04-normalization/group-pages-by-site.js';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  async start(dto: CreateResearchDto): Promise<{ status: 'completed' }> {
    this.logger.log(
      `Research started for product "${dto.name}" in ${dto.country}: ${dto.description || '(no description)'}`,
    );
    this.logger.log(
      `DeepSeek API key loaded: ${Boolean(process.env.DEEPSEEK_API_KEY)}`,
    );
    this.logger.log(`LLM config: ${JSON.stringify(LLM_CONFIG)}`);
    this.logger.log(`SENT SYSTEM PROMPT:\n${PRODUCT_PROFILE_PROMPT}`);

    // stage 1 - prepare product profile
    const profile = await createProductProfile(dto);

    // stage 2 - create research plan
    const plan = await createResearchPlan(profile, dto.country);

    this.logger.log(`Research plan:\n${JSON.stringify(plan, null, 2)}`);

    // stage 3 - search preparation & discovery
    const { searchRuns, deferred } = await runSearches(plan, dto.country);
    const totalResults = searchRuns.reduce(
      (total, run) => total + run.results.length,
      0,
    );

    this.logger.log(
      `Search batch completed: queries=${searchRuns.length}, results=${totalResults}, deferred=${deferred.length}`,
    );

    // stage 4 - normalization & deduplication
    const candidates = collectPageCandidates(searchRuns);
    const siteGroups = groupPagesBySite(candidates);
    const groupedPages = siteGroups.reduce(
      (total, group) => total + group.pages.length,
      0,
    );

    const groupedDiscoveries = siteGroups.reduce(
      (total, group) =>
        total +
        group.pages.reduce(
          (pageTotal, page) => pageTotal + page.discoveries.length,
          0,
        ),
      0,
    );

    this.logger.log(
      `Site grouping: sites=${siteGroups.length}, pages=${groupedPages}, discoveries=${groupedDiscoveries}`,
    );

    this.logger.log(
      `Site groups:\n${JSON.stringify(
        siteGroups.map((group) => ({
          hostname: group.hostname,
          urls: group.pages.map((page) => page.url),
        })),
        null,
        2,
      )}`,
    );

    const discoveryCount = candidates.reduce(
      (total, candidate) => total + candidate.discoveries.length,
      0,
    );

    this.logger.log(
      `Page candidates: rawResults=${totalResults}, uniqueUrls=${candidates.length}, discoveries=${discoveryCount}`,
    );

    this.logger.log(
      `Page candidates summary:\n${JSON.stringify(
        candidates.map((candidate) => ({
          url: candidate.url,
          hostname: candidate.hostname,
          foundBy: candidate.discoveries.map(
            (discovery) => discovery.search.task.id,
          ),
        })),
        null,
        2,
      )}`,
    );

    return { status: 'completed' };
  }
}
