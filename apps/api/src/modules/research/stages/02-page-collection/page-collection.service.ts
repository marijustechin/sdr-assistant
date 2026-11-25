import { Injectable, Logger } from '@nestjs/common';
import { type IdentificationFixture } from '../../lib/research-fixture.lib.js';
import { isInsufficientBalanceError, llmChat } from '../../lib/llm-chat.js';
import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import { PAGE_TRIAGE_PROMPT } from './page-triage.prompt.js';
import { pageTriageSchema, type PageTriage } from './page-triage.schema.js';
import { stripCodeFence } from '../../lib/strip-code.fense.js';
import {
  type PageForAssessment,
  ProductIdentificationResponse,
  TermCandidates,
} from '../../types.js';
import {
  mergePages,
  preparePagesForAssessment,
} from '../../pipeline/page-preparation.js';
import { searchTermCandidates } from '../../pipeline/term-search.js';
import {
  resolveFileName,
  slugify,
  timestampForFileName,
  writeJsonFile,
} from '../../lib/utils.js';
import { CreateResearchDto } from '../../dto/create-research.dto.js';
import { fetchMissingPageContent } from '../../pipeline/fetch-pages.js';
import {
  TERM_GENERATION_PROMPT,
  TERM_GENERATION_PROMPT_VERSION,
} from './term-generation.prompt.js';
import { termGenerationSchema } from './term-generation.schema.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';

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
  constructor(private readonly prismaService: PrismaService) {}
  private readonly logger = new Logger('PageCollection');

  async collect(
    input: CreateResearchDto,
    identifiedProduct: ProductIdentificationResponse,
    targetLanguage: string,
    jobId: string,
    onStage?: (stage: string) => Promise<void>,
    resultsPerQuery: number = 20,
  ): Promise<PageForAssessment[]> {
    const { product, sourcePages } = identifiedProduct;
    const runTag = `qc${resultsPerQuery}-${slugify(identifiedProduct.product.generalCategoryName)}-${timestampForFileName()}`;

    // 2.1 Search terms generation
    await onStage?.('2.1 Generating search terms...');
    const { productName, categoryName, generalCategoryName, notes } = product;

    // Pages that already show the broadest category name: the prompt uses them
    // as evidence of the market's wording instead of relying on the model's
    // translation of the English description. Only what the prompt declares is
    // passed on: a domain, a title and a short excerpt around the match.
    const categoryPages = pagesWithCategory(sourcePages, generalCategoryName);
    const sourceWithCategory = categoryPages.map((page) => ({
      domain: page.domain,
      title: page.title ?? '',
      excerpt: pageExcerpt(page, generalCategoryName),
    }));

    const seedTerms = {
      productDescription: input.description,
      productNames: [productName],
      categoryNames: [categoryName, generalCategoryName],
      notes,
      sourceWithCategory,
      targetLanguage,
      targetCountry: input.country,
    };

    const response = await llmChat(
      LLM_CONFIG_FLASH,
      TERM_GENERATION_PROMPT,
      seedTerms,
    );

    const raw = response.choices[0]?.message.content ?? '';
    const additionalTerms = termGenerationSchema.parse(
      JSON.parse(stripCodeFence(raw)),
    );

    await writeJsonFile(resolveFileName(`02.1-search-terms-${runTag}`), {
      promptVersion: TERM_GENERATION_PROMPT_VERSION,
      seedTerms,
      additionalTerms,
    });

    // Terms search
    await onStage?.('2.2 Searching terms...');
    const queries = additionalTerms.queries;

    const searchTerms: TermCandidates = {
      productNames: [
        ...seedTerms.productNames,
        ...queries.filter((q) => q.kind === 'product').map((q) => q.query),
      ],
      categoryNames: [
        ...seedTerms.categoryNames,
        ...queries.filter((q) => q.kind === 'category').map((q) => q.query),
      ],
      notes: seedTerms.notes,
      targetLanguage,
    };
    const initialPages = await searchTermCandidates(searchTerms, {
      country: input.country,
      resultsPerQuery,
    });

    // Merge pages
    await onStage?.('2.3 Merging pages...');
    const searchPages = preparePagesForAssessment(initialPages);
    const mergedPages = mergePages(identifiedProduct.sourcePages, searchPages);

    // Fetch missing content
    await onStage?.('2.4 Fetching missing page content...');
    const fetchResults = await fetchMissingPageContent(mergedPages);

    const pagesWithText = fetchResults.map((result) => result.page);
    await writeJsonFile(
      resolveFileName(`02.4-response-${runTag}`),
      pagesWithText,
    );

    const result = structuredClone(pagesWithText) as Prisma.InputJsonValue;

    await this.prismaService.researchStage02.upsert({
      where: { jobId },
      create: {
        jobId,
        result,
      },
      update: {
        result,
      },
    });

    return pagesWithText;
  }

  /**
   * TEMPORARY (stage 02 development): classifies the sample page by page.
   *
   * One LLM call per page, at most `TRIAGE_CONCURRENCY` at a time. A page that
   * fails is a value, so one bad page cannot hide or block the others — except
   * an exhausted provider balance, which is fatal: no further page is started,
   * the pages already in flight are awaited, and only then is the error thrown.
   * Waiting first matters: a late progress update must not land after the run
   * has already been marked failed.
   */
  async processPages(
    pages: PageForAssessment[],
    fixture: IdentificationFixture,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<PageTriageResult[]> {
    const results = new Array<PageTriageResult>(pages.length);
    let nextIndex = 0;
    let processed = 0;
    let fatal: unknown = null;

    const worker = async (): Promise<void> => {
      while (fatal === null && nextIndex < pages.length) {
        const position = nextIndex;
        nextIndex += 1;

        try {
          results[position] = await this.triagePage(pages[position], fixture);
        } catch (error) {
          // `triagePage` only rethrows fatal provider errors.
          fatal ??= error;
          return;
        }

        processed += 1;
        // eslint-disable-next-line no-await-in-loop
        await onStage?.(`2.3 Processing pages ${processed}/${pages.length}`);
      }
    };

    // `allSettled` so in-flight pages finish before the error is propagated.
    const settled = await Promise.allSettled(
      Array.from({ length: Math.min(TRIAGE_CONCURRENCY, pages.length) }, () =>
        worker(),
      ),
    );

    if (fatal !== null) {
      this.logger.error(
        'Page triage stopped: DeepSeek API reported insufficient balance (HTTP 402)',
      );

      throw new Error(
        'Stage 02 page triage stopped: DeepSeek API reported insufficient balance (HTTP 402)',
        { cause: fatal },
      );
    }

    // A worker rejects only when something other than the triage call fails,
    // e.g. a database error in the progress update. That is fatal too.
    const rejected = settled.find((entry) => entry.status === 'rejected');

    if (rejected?.status === 'rejected') {
      throw rejected.reason;
    }

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
      if (isInsufficientBalanceError(error)) {
        // Fatal for the whole run: every further call would fail the same way.
        throw error;
      }

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

/** Case- and diacritic-insensitive form used to match category words. */
function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/** Words of the category name in the form used for matching. */
function categoryWords(categoryName: string): string[] {
  return normalizeForMatch(categoryName)
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Pages from stage 01 that already show the broadest category name.
 *
 * Every word of the name must appear somewhere in the page text, in any order
 * and in any field: a phrase test would drop a page that says "pirties" in one
 * sentence and "dailylentės" in another, while triage keeps it. Comparison
 * ignores case and diacritics, so a page written without Lithuanian diacritics
 * is not lost. Matching stays literal: other word forms and synonyms do not
 * match, which keeps the input close to what triage accepts.
 */
function pagesWithCategory(
  pages: PageForAssessment[],
  categoryName: string,
): PageForAssessment[] {
  const words = categoryWords(categoryName);

  if (words.length === 0) {
    return [];
  }

  return pages.filter((page) => {
    const text = normalizeForMatch(
      [page.title, page.content, ...page.highlights, ...page.snippets]
        .filter(Boolean)
        .join(' '),
    );

    return words.every((word) => text.includes(word));
  });
}

/** How much page text one model input item carries. */
const CATEGORY_EXCERPT_CHARS = 400;

/**
 * The part of a page that shows the category name, so the prompt receives what
 * it declares — a domain, a title and a short excerpt — instead of the whole
 * page. The excerpt starts at the first line that contains a word of the
 * category name and grows to about `CATEGORY_EXCERPT_CHARS`; the model needs
 * the wording around the match, not the full text.
 */
function pageExcerpt(page: PageForAssessment, categoryName: string): string {
  const words = categoryWords(categoryName);

  const lines = [page.content ?? '', ...page.highlights, ...page.snippets]
    .flatMap((text) => text.split(/\n+/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const firstMatch = lines.findIndex((line) => {
    const normalized = normalizeForMatch(line);

    return words.some((word) => normalized.includes(word));
  });

  const start = firstMatch === -1 ? 0 : firstMatch;
  const excerpt: string[] = [];
  let length = 0;

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];

    if (length > 0 && length + line.length + 1 > CATEGORY_EXCERPT_CHARS) {
      break;
    }

    excerpt.push(line);
    length += line.length + 1;

    if (length >= CATEGORY_EXCERPT_CHARS) {
      break;
    }
  }

  return excerpt.join(' ').slice(0, CATEGORY_EXCERPT_CHARS);
}
