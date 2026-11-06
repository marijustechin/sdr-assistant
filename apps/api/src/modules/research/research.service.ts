import { Injectable, Logger } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';

import type { CreateResearchDto } from './dto/create-research.dto.js';

import { PRODUCT_PROFILE_PROMPT } from './stages/01-product-profile/product-profile.prompt.js';
import { LLM_CONFIG } from './config/llm-config.js';
import { CRAWL_EXECUTION_CONFIG } from './config/crawl-execution.config.js';

import { createProductProfile } from './stages/01-product-profile/create-product-profile.js';
import { createResearchPlan } from './stages/02-research-plan/create-research-plan.js';
import { runSearches } from './stages/03-discovery/run-searches.js';
import { collectPageCandidates } from './stages/04-normalization/collect-page-candidates.js';
import { groupPagesBySite } from './stages/04-normalization/group-pages-by-site.js';
import { buildCrawlQueue } from './stages/05-triage/build-crawl-queue.js';
import { prepareCrawlExecution } from './stages/05-triage/prepare-crawl-execution.js';
import { fetchPages } from './stages/06-fetch/fetch-pages.js';
import { RESEARCH_PLAN_PROMPT } from './stages/02-research-plan/research-plan.prompt.js';
import { SEARCH_EXECUTION_CONFIG } from './config/search-execution.config.js';

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

    // laikinas rezultatu irašymas

    const createdAt = new Date().toISOString();
    const outputFile = `discovery-${createdAt.replaceAll(':', '-')}.json`;

    await writeFile(
      outputFile,
      JSON.stringify(
        {
          createdAt,
          input: dto,

          prompts: {
            productProfile: PRODUCT_PROFILE_PROMPT,
            researchPlan: RESEARCH_PLAN_PROMPT,
          },

          config: {
            llm: LLM_CONFIG,
            search: SEARCH_EXECUTION_CONFIG,
          },

          profile,
          plan,
          searchRuns,
          deferredSearches: deferred,
          siteGroups,
        },
        null,
        2,
      ),
      'utf8',
    );

    this.logger.log(
      `Discovery saved: ${outputFile}, sites=${siteGroups.length}, pages=${candidates.length}`,
    );

    // stage 5 - crawl *******************************************************************************
    // const crawlQueue = buildCrawlQueue(siteGroups);

    // this.logger.log(
    //   `Crawl queue: sites=${siteGroups.length}, pages=${crawlQueue.length}`,
    // );

    // this.logger.log(
    //   `Crawl queue preview:\n${JSON.stringify(
    //     crawlQueue.slice(0, 10).map((page, index) => ({
    //       position: index + 1,
    //       hostname: page.hostname,
    //       url: page.url,
    //     })),
    //     null,
    //     2,
    //   )}`,
    // );

    // const crawlExecution = prepareCrawlExecution(
    //   crawlQueue,
    //   CRAWL_EXECUTION_CONFIG.maxPages,
    // );

    // this.logger.log(
    //   `Crawl selection: selected=${crawlExecution.selected.length}, deferred=${crawlExecution.deferred.length}, total=${crawlQueue.length}`,
    // );

    // this.logger.log(
    //   `Selected crawl pages:\n${JSON.stringify(
    //     crawlExecution.selected.map((page) => ({
    //       url: page.url,
    //       directions: [
    //         ...new Set(
    //           page.discoveries.map(
    //             (discovery) => discovery.search.task.direction,
    //           ),
    //         ),
    //       ],
    //     })),
    //     null,
    //     2,
    //   )}`,
    // );

    // // stage 6 - fetch pages -----------------------------------------------------
    // const fetchedPages = await fetchPages(crawlExecution.selected);

    // await writeFile(
    //   'crawl-results.json',
    //   JSON.stringify(
    //     {
    //       input: dto,
    //       profile,
    //       plan,
    //       fetchedPages,
    //       deferredPages: crawlExecution.deferred,
    //       deferredSearches: deferred,
    //     },
    //     null,
    //     2,
    //   ),
    //   'utf8',
    // );

    // const succeeded = fetchedPages.filter(
    //   (result) => result.status === 'succeeded',
    // ).length;

    // this.logger.log(
    //   `Fetch completed: succeeded=${succeeded}, failed=${fetchedPages.length - succeeded}, deferred=${crawlExecution.deferred.length}`,
    // );

    // this.logger.log('Saved: crawl-results.json');

    return { status: 'completed' };
  }
}
