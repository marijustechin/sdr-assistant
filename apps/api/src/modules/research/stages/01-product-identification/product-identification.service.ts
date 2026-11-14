import { Injectable, Logger } from '@nestjs/common';
import countries from 'i18n-iso-countries';

import { LLM_CONFIG } from '../../config/llm-config.js';
import { CreateResearchDto } from '../../dto/create-research.dto.js';
import { dsSearch } from '../../lib/ds-search.js';
import { searchExa } from '../../lib/exa-search.js';
import { llmChat } from '../../lib/llm-chat.js';
import { stripCodeFence } from '../../lib/strip-code.fense.js';
import { PAGE_ASSESSMENT_PROMPT } from './page-assessment.prompt.js';
import {
  type IdentifiedProduct,
  identifiedProductSchema,
} from './product-identification.schema.js';
import { PageForAssessment } from '../../types.js';
import {
  IdentificationFixture,
  writeIdentificationFixture,
} from '../../lib/research-fixture.lib.js';

type TermCandidates = {
  productNames: string[];
  categoryNames: string[];
  notes: string;
};

type TermSearchResult = {
  url: string;
  title: string | null;
  highlights: string[];
  snippet: string | null;
  summary: string | null;
  content: string | null;
};

type TermSearchRun = {
  term: string;
  kind: 'product' | 'category';
  provider: 'exa' | 'deepseek';
  country: string;
  searchedAt: string;
  results: TermSearchResult[];
  error?: string;
};

@Injectable()
export class ProductIdentificationService {
  async identify(
    dto: CreateResearchDto,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<IdentifiedProduct> {
    const countryCode = countries.getAlpha2Code(dto.country, 'en') ?? 'xx';
    const targetCountry = dto.country;

    const languageByCountry: Record<string, string> = {
      LT: 'Lithuanian',
      LV: 'Latvian',
      EE: 'Estonian',
      DE: 'German',
      HU: 'Hungarian',
      PL: 'Polish',
      ES: 'Spanish',
    };

    const targetLanguage = languageByCountry[countryCode.toUpperCase()];

    if (!targetLanguage) {
      throw new Error(`Target language is not configured for ${targetCountry}`);
    }

    await onStage?.('Generating term candidates...');
    const termCandidates = await this.generateTermCandidates(
      targetLanguage,
      targetCountry,
      dto.name,
      dto.description,
    );

    await onStage?.('Searching term candidates...');
    const searchedTermCandidates = await this.searchTermCandidates(
      termCandidates,
      targetCountry,
    );

    await onStage?.('Preparing pages for assessment...');
    const preparedCandidates = this.preparePagesForAssessment(
      searchedTermCandidates,
    );

    await onStage?.('Identifying the product...');
    const identifiedProduct = await this.identifyProduct(
      preparedCandidates,
      targetLanguage,
      targetCountry,
      dto.name,
      dto.description,
    );

    // laikinai irasome rezultatus i faila
    // const data: IdentificationFixture = {
    //   input: {
    //     name: dto.name,
    //     description: dto.description,
    //     country: dto.country,
    //   },
    //   targetLanguage,
    //   product: identifiedProduct,
    //   pages: preparedCandidates,
    // };
    // await writeIdentificationFixture('rubai-pl', data);

    return identifiedProduct;
  }

  /**
   * ***********************************************************************************
   * @param targetLanguage
   * @param targetCountry
   * @param productName
   * @param productDescription
   * @returns
   */
  private async generateTermCandidates(
    targetLanguage: string,
    targetCountry: string,
    productName: string,
    productDescription?: string,
  ): Promise<TermCandidates> {
    const systemPrompt = `
You suggest natural commercial product and category names
in ${targetLanguage} for the ${targetCountry} market.

The source product name and description are in English.
Preserve the product's meaning while adapting its names to the target market.
Prefer natural commercial wording over word-for-word translation.

Return valid JSON only, with exactly this shape:
{
  "productNames": ["..."],
  "categoryNames": ["..."],
  "notes": "..."
}

Rules:
- productNames: names for the described product, preserving its identity,
  material and treatment where relevant.
- categoryNames: general product categories that sellers of this product
  would use, without requiring its particular material or treatment.
- Include the general category without an application restriction where
  a natural commercial term exists.
- Keep categories relevant to the product. Avoid excessively broad terms
  such as "building materials".
- Include useful synonyms, alternative commercial names and spelling variants.
- Do not fill the lists with mechanical singular/plural combinations.
- Do not include adjacent products or applications unsupported by the input.
- Return up to 15 productNames and up to 10 categoryNames.
  Fewer good candidates are better than filling a quota.
- Order candidates by likely commercial usefulness.
- All names must be in the target market's language; established borrowed
  product and material names are allowed.
- These are candidates for subsequent web verification.
  Do not claim that you searched the web, verified usage or measured popularity.
- If terminology is uncertain, explain that briefly in notes.
- notes must be short and in English.
`.trim();

    const userContent = {
      sourceLanguage: 'English',
      productName,
      description: productDescription ?? '',
      targetLanguage,
      targetCountry,
    };

    const response = await llmChat(LLM_CONFIG, systemPrompt, userContent);
    const raw = response.choices[0]?.message.content ?? '';
    const content = stripCodeFence(raw);

    let parsed: TermCandidates;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Term candidates JSON parse failed: ${String(error)}`);
    }

    if (
      !Array.isArray(parsed.productNames) ||
      !Array.isArray(parsed.categoryNames)
    ) {
      throw new TypeError('Term candidates JSON has invalid shape');
    }

    return parsed;
  }

  /**
   * ******************************************************************************
   * @param termCandidates
   * @param country
   * @returns
   */
  private async searchTermCandidates(
    termCandidates: TermCandidates,
    country: string,
  ): Promise<TermSearchRun[]> {
    const seen = new Set<string>();

    const terms = [
      ...termCandidates.productNames.map((term) => ({
        term: term.trim(),
        kind: 'product' as const,
      })),
      ...termCandidates.categoryNames.map((term) => ({
        term: term.trim(),
        kind: 'category' as const,
      })),
    ].filter(({ term, kind }) => {
      if (!term) {
        return false;
      }

      const key = `${kind}:${term.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    const providers = ['exa', 'deepseek'] as const;

    const jobs = terms.flatMap(({ term, kind }) =>
      providers.map((provider) => ({
        term,
        kind,
        provider,
      })),
    );

    const searchRuns: TermSearchRun[] = [];
    const concurrency = 4;

    for (let index = 0; index < jobs.length; index += concurrency) {
      const batch = jobs.slice(index, index + concurrency);

      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.all(
        batch.map(async (job): Promise<TermSearchRun> => {
          const baseRun = {
            ...job,
            country,
            searchedAt: new Date().toISOString(),
          };

          try {
            let results: TermSearchResult[];

            if (job.provider === 'exa') {
              const response = await searchExa(job.term, 5, country);

              results = response.results.map((result) => ({
                url: result.url,
                title: result.title,
                highlights: result.highlights,
                snippet: null,
                summary: null,
                content: null,
              }));
            } else {
              const response = await dsSearch(job.term, 5);

              results = response.results.map((result) => ({
                url: result.url,
                title: result.title,
                highlights: [],
                snippet: result.snippet,
                summary: result.summary,
                content: result.content || null,
              }));
            }

            return {
              ...baseRun,
              results,
            };
          } catch (error) {
            return {
              ...baseRun,
              results: [],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      searchRuns.push(...batchResults);
    }

    return searchRuns;
  }

  /**
   * *******************************************************************************
   * @param searchRuns
   * @returns
   */
  private preparePagesForAssessment(
    searchRuns: TermSearchRun[],
  ): PageForAssessment[] {
    const trackingParams = new Set([
      'fbclid',
      'gclid',
      'yclid',
      'mc_cid',
      'mc_eid',
    ]);

    // This is a grouping key, not the site's canonical URL. Path case, language
    // segments and all meaningful query parameters are preserved.
    const canonicalizeUrl = (raw: string): string => {
      try {
        const parsed = new URL(raw);
        parsed.hash = '';

        const keptParams = [...parsed.searchParams.entries()]
          .filter(([key]) => {
            const normalizedKey = key.toLowerCase();

            return (
              !normalizedKey.startsWith('utm_') &&
              !trackingParams.has(normalizedKey)
            );
          })
          .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
            return (
              leftKey.localeCompare(rightKey) ||
              leftValue.localeCompare(rightValue)
            );
          });

        parsed.search = new URLSearchParams(keptParams).toString();

        return parsed.toString();
      } catch {
        return raw.trim();
      }
    };

    const domainOf = (raw: string): string => {
      try {
        return new URL(raw).hostname;
      } catch {
        return '';
      }
    };

    const pages = new Map<string, PageForAssessment>();

    for (const run of searchRuns) {
      for (const result of run.results) {
        const canonicalUrl = canonicalizeUrl(result.url);
        const existing = pages.get(canonicalUrl);

        if (!existing) {
          const page: PageForAssessment = {
            url: result.url,
            canonicalUrl,
            domain: domainOf(result.url),
            title: result.title?.trim() || null,
            foundBy: [
              {
                term: run.term,
                kind: run.kind,
                provider: run.provider,
              },
            ],
            foundCount: 1,
            highlights: [],
            snippets: [],
            summary: result.summary ?? null,
            content: result.content ?? null,
          };

          this.addUniqueTexts(page.highlights, result.highlights ?? []);

          if (result.snippet) {
            this.addUniqueTexts(page.snippets, [result.snippet]);
          }

          pages.set(canonicalUrl, page);
          continue;
        }

        this.mergeAssessmentPage(existing, result, run);
      }
    }

    return [...pages.values()];
  }

  /**
   * *************************************************************************************
   * @param existing
   * @param result
   * @param run
   */
  private mergeAssessmentPage(
    existing: PageForAssessment,
    result: TermSearchResult,
    run: TermSearchRun,
  ): void {
    const alreadyFound = existing.foundBy.some(
      (origin) =>
        origin.term === run.term &&
        origin.kind === run.kind &&
        origin.provider === run.provider,
    );

    if (!alreadyFound) {
      existing.foundBy.push({
        term: run.term,
        kind: run.kind,
        provider: run.provider,
      });
    }

    existing.foundCount = existing.foundBy.length;

    this.addUniqueTexts(existing.highlights, result.highlights ?? []);

    if (result.snippet) {
      this.addUniqueTexts(existing.snippets, [result.snippet]);
    }

    if (
      result.title &&
      result.title.trim().length > (existing.title?.length ?? 0)
    ) {
      existing.title = result.title.trim();
    }

    if (
      result.summary &&
      result.summary.length > (existing.summary?.length ?? 0)
    ) {
      existing.summary = result.summary;
    }

    if (
      result.content &&
      result.content.length > (existing.content?.length ?? 0)
    ) {
      existing.content = result.content;
    }
  }

  private addUniqueTexts(target: string[], values: string[]): void {
    for (const value of values) {
      if (value.trim() && !target.includes(value)) {
        target.push(value);
      }
    }
  }

  /**
   * ****************************************************************************************
   * @param pages
   * @param targetLanguage
   * @param targetCountry
   * @param productName
   * @param productDescription
   * @returns
   */
  private async identifyProduct(
    pages: PageForAssessment[],
    targetLanguage: string,
    targetCountry: string,
    productName: string,
    productDescription?: string,
  ): Promise<IdentifiedProduct> {
    const systemPrompt = `${PAGE_ASSESSMENT_PROMPT}

Use ${targetLanguage} commercial product and category names for ${targetCountry}.
Do not choose a different output language from the source pages.
Established borrowed material names are allowed. Keep explanations in English.`;

    const response = await llmChat(LLM_CONFIG, systemPrompt, {
      targetLanguage,
      targetCountry,
      product: {
        name: productName,
        description: productDescription ?? '',
      },
      pages,
    });

    const choice = response.choices[0];

    if (!choice) {
      throw new Error('Product identification: LLM returned no choice');
    }

    if (choice.finish_reason !== 'stop') {
      throw new Error(
        `Product identification: incomplete LLM response (${choice.finish_reason})`,
      );
    }

    const content = stripCodeFence(choice.message.content ?? '').trim();

    if (!content) {
      throw new Error('Product identification: LLM returned empty content');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error('Product identification: invalid JSON', {
        cause: error,
      });
    }

    return identifiedProductSchema.parse(parsed);
  }
}
