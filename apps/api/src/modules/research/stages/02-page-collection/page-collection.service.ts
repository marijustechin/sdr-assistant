import { Injectable, Logger } from '@nestjs/common';
import { type IdentificationFixture } from '../../lib/research-fixture.lib.js';
import { llmChat } from '../../lib/llm-chat.js';
import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import {
  PAGE_TRIAGE_PROMPT,
  PAGE_TRIAGE_PROMPT_VERSION,
} from './page-triage.prompt.js';
import { pageTriageSchema, type PageTriage } from './page-triage.schema.js';
import { stripCodeFence } from '../../lib/strip-code.fense.js';
import {
  type PageForAssessment,
  ProductIdentificationResponse,
  TermCandidates,
  TriageReport,
} from '../../types.js';
import {
  mergePages,
  preparePagesForAssessment,
} from '../../pipeline/page-preparation.js';
import { searchTermCandidates } from '../../pipeline/term-search.js';
import {
  readJsonFile,
  resolveFileName,
  writeJsonFile,
} from '../../lib/utils.js';
import { CreateResearchDto } from '../../dto/create-research.dto.js';

type PageTriageResult = {
  page: PageForAssessment;
  triage: PageTriage | null;
  error?: string;
};

/**
 * Pages triaged at the same time. Triage is one independent LLM call per page,
 * so a few in flight cost nothing but time saved; the cap keeps a single hung
 * call from parking the whole stage while staying well below the provider's
 * rate limits.
 */
const TRIAGE_CONCURRENCY = 6;

@Injectable()
export class PageCollectionService {
  private readonly logger = new Logger('PageCollection');

  async collect(
    input: CreateResearchDto,
    identifiedProduct: ProductIdentificationResponse,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<PageForAssessment[]> {
    // Searching terms
    // await onStage?.('2.1 Searching terms...');
    // const names: TermCandidates = {
    //   productNames: [identifiedProduct.product.productName],
    //   categoryNames: [
    //     identifiedProduct.product.categoryName,
    //     identifiedProduct.product.generalCategoryName,
    //   ],
    //   notes: '',
    // };
    // const initialPages = await searchTermCandidates(names, {
    //   country: input.country,
    //   resultsPerQuery: 20,
    // });
    // //laikinas
    // const fileNameInitialPages = resolveFileName('02.1-initial-pages');
    // await writeJsonFile(fileNameInitialPages, initialPages);
    // ////// laikinas pabaiga

    // // Merge pages
    // await onStage?.('2.2 Merging pages...');
    // const searchPages = preparePagesForAssessment(initialPages);
    // const mergedPages = mergePages(identifiedProduct.sourcePages, searchPages);

    //  //laikinas
    // const fileNameMergedPages = resolveFileName('02.1-initial-pages');
    // await writeJsonFile(fileNameInitialPages, mergedPages);
    // ////// laikinas pabaiga

    // // Fetch missing content
    // await onStage?.('2.2 Fetching missing page content...');
    // const fetchResults = await fetchMissingPageContent(mergedPages);

    // const pagesWithText = fetchResults.map((result) => result.page);
    const pagesWithText: PageForAssessment[] = await readJsonFile(
      resolveFileName('02.1-merged-pages'),
    );
    // const fetchResults = await fetchMissingPageContent(mergedPages);

    // Process pages
    const processedPages = await this.processPages(
      pagesWithText,
      {
        input: input,
        targetLanguage: input.country,
        product: identifiedProduct.product,
        pages: identifiedProduct.sourcePages,
      },
      onStage,
    );

    const triageFilePath = resolveFileName('02.2-tirage');

    const product: IdentificationFixture = {
      input,
      targetLanguage: input.country,
      product: identifiedProduct.product,
      pages: identifiedProduct.sourcePages,
    };

    await writeJsonFile(
      triageFilePath,
      buildTriageReport({
        results: processedPages,
        fixture: product,
        promptVersion: PAGE_TRIAGE_PROMPT_VERSION,
      }),
    );

    const filteredPages = processedPages
      .filter((result) => result.triage?.verdict === 'good')
      .map((result) => result.page);

    // Laikinas rezultatu irasymas
    const fileNameForFilteredPages = resolveFileName(
      '02.3-page-collection-response',
    );
    await writeJsonFile(fileNameForFilteredPages, filteredPages);
    ////////// Laikinas pabaiga

    return filteredPages;
  }

  /**
   * TEMPORARY (stage 02 development): classifies the sample page by page.
   *
   * One LLM call per page, at most `TRIAGE_CONCURRENCY` at a time. Every call
   * is independent and `triagePage` turns a failure into a value, so one bad or
   * slow page can neither hide nor block the others. Results keep the input
   * order, and the stage text carries the progress so the UI shows `x/y`.
   */
  async processPages(
    pages: PageForAssessment[],
    fixture: IdentificationFixture,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<PageTriageResult[]> {
    const results = new Array<PageTriageResult>(pages.length);
    let nextIndex = 0;
    let processed = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < pages.length) {
        const position = nextIndex;
        nextIndex += 1;

        results[position] = await this.triagePage(pages[position], fixture);

        processed += 1;
        await onStage?.(`2.3 Processing pages ${processed}/${pages.length}`);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(TRIAGE_CONCURRENCY, pages.length) }, () =>
        worker(),
      ),
    );

    return results;
  }

  private async triagePage(
    page: PageForAssessment,
    fixture: IdentificationFixture,
  ): Promise<PageTriageResult> {
    try {
      const response = await llmChat(
        LLM_CONFIG_FLASH,
        PAGE_TRIAGE_PROMPT,
        this.buildTriageInput(page, fixture),
      );

      const raw = response.choices[0]?.message.content ?? '';
      const triage = pageTriageSchema.parse(JSON.parse(stripCodeFence(raw)));

      return { page, triage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Triage failed for ${page.domain}: ${message}`);

      return { page, triage: null, error: message };
    }
  }

  private pageText(page: PageForAssessment): string {
    return [
      page.content,
      page.summary,
      page.highlights.join(' '),
      page.snippets.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }

  private buildTriageInput(
    page: PageForAssessment,
    fixture: IdentificationFixture,
  ) {
    return {
      targetCountry: fixture.input.country,
      generalCategoryName: fixture.product.generalCategoryName,
      page: {
        url: page.url,
        title: page.title,
        text: this.pageText(page),
      },
    };
  }
}

/**
 * TEMPORARY (stage 02 development): writes a random subset of `pages` to
 * `filePath` so the per-page work can run on a small input.
 *
 * Fisher-Yates shuffle, so every page has exactly the same chance of being
 * picked. If there are fewer pages than `size`, all of them are written.
 */
async function writeRandomPageSample(
  filePath: string,
  pages: PageForAssessment[],
  size: number,
): Promise<void> {
  const shuffled = [...pages];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    const value = shuffled[index];
    shuffled[index] = shuffled[swapWith];
    shuffled[swapWith] = value;
  }

  await writeJsonFile(filePath, shuffled.slice(0, size));
}

/**
 * TEMPORARY (stage 02 development): one readable file per run so prompt
 * versions can be compared without digging through the logger output.
 */
function buildTriageReport(input: {
  results: PageTriageResult[];
  fixture: IdentificationFixture;
  promptVersion: string;
}): TriageReport {
  return {
    promptVersion: input.promptVersion,
    createdAt: new Date().toISOString(),
    targetCountry: input.fixture.input.country,
    targetLanguage: input.fixture.targetLanguage,
    product: {
      productName: input.fixture.product.productName,
      categoryName: input.fixture.product.categoryName,
      generalCategoryName: input.fixture.product.generalCategoryName,
    },
    results: input.results.map(({ page, triage, error }) => ({
      url: page.url,
      domain: page.domain,
      title: page.title,
      contentChars: (page.content ?? '').length,
      verdict: triage?.verdict ?? null,
      reason: triage?.reason ?? null,
      evidence: triage?.evidence ?? null,
      error: error ?? null,
    })),
  };
}
