import { Injectable } from '@nestjs/common';
import { PageAssessmentResult } from '../03-page-assessment/page-assessment-result.js';
import { scrapePage } from '../../lib/firecrawl.js';
import { llmChat } from '../../lib/llm-chat.js';
import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import {
  resolveFileName,
  slugify,
  timestampForFileName,
  writeJsonFile,
} from '../../lib/utils.js';
import {
  prepareProfilingInput,
  type CompanyProfilingInput,
} from './company-profiling.input.js';
import {
  runFirstCall,
  type FirstCallResult,
} from './company-profiling.first-call.js';
import {
  fillProfilingGaps,
  type GapFillResult,
} from './company-profiling.gap-fill.js';
import {
  buildCompanyProfile,
  summariseCompanyProfile,
  type BuildProfileOptions,
  type CompanyProfileSummary,
} from './company-profiling.profile.js';
import type { CompanyProfile } from './company-profiling.types.js';
import {
  profileAll,
  type CompanyProfilingResult,
} from './company-profiling.batch.js';

@Injectable()
export class CompanyProfilingService {
  /**
   * The normal 04 entry: 04.1 → 04.2 → 04.3 when gaps remain → 04.4 for every
   * domain, one profile per input domain. The batch summary separates reused
   * (already saved) domains from new paid work.
   */
  async profile(
    data: PageAssessmentResult,
    onStage?: (stage: string) => Promise<void>,
    options: {
      precomputed?: ReadonlyMap<string, CompanyProfile>;
    } = {},
  ): Promise<CompanyProfilingResult> {
    const result = await profileAll(
      data,
      {
        scrape: scrapePage,
        chat: (prompt, payload) =>
          llmChat(LLM_CONFIG_FLASH, prompt, payload),
        precomputed: options.precomputed,
      },
      onStage,
    );

    await writeJsonFile(
      resolveFileName(
        `04-profiling-result-${slugify(data.product.generalCategoryName)}-${timestampForFileName()}`,
      ),
      result,
    );

    return result;
  }

  /**
   * One-domain dev/prompt-iteration path: scrape only this domain's homepage
   * once, save its 04.1 input, then run the first profiling call once.
   */
  async profileDomain(
    data: PageAssessmentResult,
    domainName: string,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<FirstCallResult> {
    const input = await prepareProfilingInput(
      data,
      scrapePage,
      onStage,
      { onlyDomains: [domainName] },
    );

    if (input.domains.length === 0) {
      throw new Error(`Domain not found in the 03 result: ${domainName}`);
    }

    await this.saveInput(input, domainName);

    return this.profileFirstCall(input, domainName, onStage);
  }

  /**
   * 04.2 for one already prepared domain. A saved 04.1 input can be passed
   * back here to compare prompt changes without scraping the homepage again.
   */
  async profileFirstCall(
    input: CompanyProfilingInput,
    domainName: string,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<FirstCallResult> {
    const domain = input.domains.find((entry) => entry.domain === domainName);

    if (!domain) {
      throw new Error(`Domain not found in the prepared input: ${domainName}`);
    }

    await onStage?.(`04.2 First profile call: ${domainName}`);

    const result = await runFirstCall(
      {
        targetCountry: input.targetCountry,
        targetLanguage: input.targetLanguage,
        product: input.product,
        domain,
        model: LLM_CONFIG_FLASH.model,
      },
      (prompt, payload) =>
        llmChat(LLM_CONFIG_FLASH, prompt, payload),
    );

    await writeJsonFile(
      resolveFileName(
        `04.2-first-call-${slugify(domainName)}-${timestampForFileName()}`,
      ),
      result,
    );

    return result;
  }

  /**
   * 04.3 for one already profiled domain: fetch the two gap pages, make one
   * follow-up call, merge the new facts and save the before → after report.
   */
  async fillGaps(
    input: CompanyProfilingInput,
    first: FirstCallResult,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<GapFillResult> {
    const result = await fillProfilingGaps(
      input,
      first,
      scrapePage,
      (prompt, payload) => llmChat(LLM_CONFIG_FLASH, prompt, payload),
      onStage,
    );

    await writeJsonFile(
      resolveFileName(
        `04.3-gap-fill-${slugify(result.domain)}-${timestampForFileName()}`,
      ),
      result,
    );
    await writeJsonFile(
      resolveFileName(
        `04.3-after-${slugify(result.domain)}-${timestampForFileName()}`,
      ),
      result.after,
    );

    return result;
  }

  /**
   * 04.4 for one already merged domain: deterministic profile, no fetch and no
   * LLM call. The summary is the company-level view with each price once.
   */
  async buildProfile(
    after: FirstCallResult,
    options: BuildProfileOptions = {},
  ): Promise<{
    profile: CompanyProfile;
    summary: CompanyProfileSummary;
  }> {
    const profile = buildCompanyProfile(after, options);
    const summary = summariseCompanyProfile(profile);

    await writeJsonFile(
      resolveFileName(
        `04.4-company-profile-${slugify(profile.domain)}-${timestampForFileName()}`,
      ),
      profile,
    );
    await writeJsonFile(
      resolveFileName(
        `04.4-company-summary-${slugify(profile.domain)}-${timestampForFileName()}`,
      ),
      summary,
    );

    return { profile, summary };
  }

  private async saveInput(
    input: CompanyProfilingInput,
    tag: string,
  ): Promise<void> {
    await writeJsonFile(
      resolveFileName(
        `04.1-profiling-input-${slugify(tag)}-${timestampForFileName()}`,
      ),
      input,
    );
  }
}
