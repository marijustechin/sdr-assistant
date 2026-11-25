import { Injectable, Logger } from '@nestjs/common';
import type { PageAssessmentInput } from '../../types.js';
import {
  resolveFileName,
  slugify,
  timestampForFileName,
  writeJsonFile,
} from '../../lib/utils.js';
import { isInsufficientBalanceError, llmChat } from '../../lib/llm-chat.js';
import { parseJsonObject } from '../../lib/parse-json-object.js';
import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import {
  PAGE_ASSESSMENT_PROMPT,
  PAGE_ASSESSMENT_PROMPT_VERSION,
  STUDY_CRITERIA_PROMPT,
} from './page-assessment.prompt.js';
import {
  buildPageFactsV4Schema,
  studyCriteriaSchema,
  type StudyCriteria,
} from './page-assessment.schema.js';
import { deriveVerdict } from './page-assessment.verdict.js';
import { type PageAssessmentResult } from './page-assessment-result.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  buildResultFromDecisions,
  countDecisions,
  decidedAssessments,
  type PageAssessmentDecision,
  type PageAssessmentState,
} from './page-assessment.checkpoint.js';

const CHECKPOINT_EVERY = 5;
const EXECUTION_LEASE_MS = 5 * 60 * 1000;

type AssessmentMode = 'new' | 'resume';

@Injectable()
export class PageAssessmentService {
  constructor(private readonly prismaService: PrismaService) {}
  private readonly logger = new Logger('PageAssessment');
  private readonly inFlight = new Set<string>();

  async assessPages(
    data: PageAssessmentInput,
    jobId: string,
    onStage?: (stage: string) => Promise<void>,
    executionToken?: string,
  ): Promise<PageAssessmentResult> {
    return this.withExecutionLock(jobId, () =>
      this.run(data, jobId, 'new', onStage, executionToken),
    );
  }

  async resumePages(
    data: PageAssessmentInput,
    jobId: string,
    onStage?: (stage: string) => Promise<void>,
    executionToken?: string,
  ): Promise<PageAssessmentResult> {
    return this.withExecutionLock(jobId, () =>
      this.run(data, jobId, 'resume', onStage, executionToken),
    );
  }

  private async withExecutionLock<T>(
    jobId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.inFlight.has(jobId)) {
      throw new Error(
        `Stage 03 is already running for job ${jobId} in this process.`,
      );
    }

    this.inFlight.add(jobId);

    try {
      return await operation();
    } finally {
      this.inFlight.delete(jobId);
    }
  }

  private async run(
    data: PageAssessmentInput,
    jobId: string,
    mode: AssessmentMode,
    onStage?: (stage: string) => Promise<void>,
    executionToken?: string,
  ): Promise<PageAssessmentResult> {
    const { targetCountry, targetLanguage, product, pages } = data;
    const runTag = `gem-${slugify(product.generalCategoryName)}-${PAGE_ASSESSMENT_PROMPT_VERSION}-${timestampForFileName()}`;

    if (pages.length === 0 && mode === 'new') {
      const result = buildResultFromDecisions(data, []);
      await this.prismaService.researchStage03.upsert({
        where: { jobId },
        create: {
          jobId,
          promptVersion: PAGE_ASSESSMENT_PROMPT_VERSION,
          decisions: [],
          decidedPages: 0,
          errorPages: 0,
          result: structuredClone(
            result,
          ) as unknown as Prisma.InputJsonValue,
        },
        update: {
          promptVersion: PAGE_ASSESSMENT_PROMPT_VERSION,
          decisions: [],
          decidedPages: 0,
          errorPages: 0,
          result: structuredClone(
            result,
          ) as unknown as Prisma.InputJsonValue,
        },
      });
      await writeJsonFile(
        resolveFileName(`03.2-assessment-result-${runTag}`),
        result,
      );
      return result;
    }

    const state =
      mode === 'new'
        ? await this.startNew(data, jobId, runTag, onStage)
        : await this.loadResume(jobId);

    for (const decision of state.decisions) {
      const page = pages[decision.pageIndex];

      if (
        !page ||
        page.url !== decision.url ||
        page.canonicalUrl !== decision.canonicalUrl
      ) {
        throw new Error(
          `Cannot resume 03: page identity changed at index ${decision.pageIndex}.`,
        );
      }
    }

    const decisions = new Map<number, PageAssessmentDecision>(
      state.decisions.map((decision) => [decision.pageIndex, decision]),
    );
    const pending = pages
      .map((page, index) => ({ page, index }))
      .filter(({ index }) => decisions.get(index) === undefined);

    let touched = 0;

    for (const { page, index } of pending) {
      // Progress doubles as the run heartbeat: stage 02 marks a run
      // INTERRUPTED when no update arrives for five minutes.
      const saved = decisions.size;
      // eslint-disable-next-line no-await-in-loop
      await onStage?.(
        `03.1 Assessing pages ${index}/${pages.length} (${saved}/${pages.length} saved)`,
      );

      const content = page.content?.trim() ?? '';
      const excerpts = [...page.highlights, ...page.snippets]
        .map((text) => text.trim())
        .filter((text) => text.length > 0 && !content.includes(text));

      const input = {
        targetCountry,
        targetLanguage,
        product: {
          productName: product.productName,
          categoryName: product.categoryName,
          generalCategoryName: product.generalCategoryName,
          description: product.description,
        },
        spec: {
          language: state.criteria.language,
          traits: state.criteria.traits,
        },
        page: {
          url: page.url,
          title: page.title,
          content,
          excerpts: [...new Set(excerpts)],
        },
      };

      let raw = '';

      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await llmChat(
          LLM_CONFIG_FLASH,
          PAGE_ASSESSMENT_PROMPT,
          input,
          'gemini',
        );

        raw = response.choices[0]?.message.content ?? '';

        const factsSchema = buildPageFactsV4Schema(
          state.criteria.traits.map(({ name }) => name),
        );
        const facts = factsSchema.parse(parseJsonObject(raw));
        const pageText = [page.title ?? '', content, ...input.page.excerpts];
        const quote = facts.market.note?.replace(/\s+/gu, ' ').trim();

        if (
          facts.market.status !== 'unclear' &&
          (!quote ||
            !pageText.some((text) =>
              text.replace(/\s+/gu, ' ').includes(quote),
            ))
        ) {
          facts.market = { status: 'unclear', note: null };
        }

        const outcome = deriveVerdict(facts, state.criteria);
        const excludedFrom04 =
          facts.offerLanguage === 'other' && facts.market.status !== 'target'
            ? 'offer_language_mismatch'
            : null;

        decisions.set(index, {
          pageIndex: index,
          url: page.url,
          canonicalUrl: page.canonicalUrl,
          status: 'decided',
          verdict: outcome.verdict,
          reason: outcome.reason,
          facts,
          excludedFrom04,
          error: null,
        });
      } catch (error) {
        if (isInsufficientBalanceError(error)) throw error;

        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(`Assessment skipped for ${page.url}: ${message}`);

        // eslint-disable-next-line no-await-in-loop
        await writeJsonFile(
          resolveFileName(
            `03.1-raw-failure-${String(index).padStart(3, '0')}-${runTag}`,
          ),
          { url: page.url, raw, input, error: message },
        );

        decisions.set(index, {
          pageIndex: index,
          url: page.url,
          canonicalUrl: page.canonicalUrl,
          status: 'error',
          verdict: null,
          reason: null,
          facts: null,
          excludedFrom04: null,
          error: message,
        });
      }

      touched += 1;

      if (touched % CHECKPOINT_EVERY === 0) {
        // eslint-disable-next-line no-await-in-loop
        await this.saveCheckpoint(data, jobId, decisions, executionToken);
      }
    }

    await onStage?.('03.2 Preparing assessment result...');
    const result = await this.saveCheckpoint(
      data,
      jobId,
      decisions,
      executionToken,
    );

    const ordered = this.orderedDecisions(decisions);
    await writeJsonFile(
      resolveFileName(`03.1-assessed-pages-${runTag}`),
      decidedAssessments(ordered),
    );
    await writeJsonFile(
      resolveFileName(`03.2-assessment-result-${runTag}`),
      result,
    );

    return result;
  }

  private async startNew(
    data: PageAssessmentInput,
    jobId: string,
    runTag: string,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<PageAssessmentState> {
    await onStage?.('03.1 Preparing assessment criteria...');

    const criteriaResponse = await llmChat(
      LLM_CONFIG_FLASH,
      STUDY_CRITERIA_PROMPT,
      {
        targetLanguage: data.targetLanguage,
        targetCountry: data.targetCountry,
        product: data.product,
      },
      'gemini',
    );

    const criteria = studyCriteriaSchema.parse(
      parseJsonObject(criteriaResponse.choices[0]?.message.content ?? ''),
    );

    if (criteria.language !== data.targetLanguage) {
      throw new Error(
        `03 criteria language "${criteria.language}" does not match targetLanguage "${data.targetLanguage}".`,
      );
    }

    const criteriaJson = structuredClone(
      criteria,
    ) as unknown as Prisma.InputJsonValue;

    await this.prismaService.researchStage03.upsert({
      where: { jobId },
      create: {
        jobId,
        criteria: criteriaJson,
        promptVersion: PAGE_ASSESSMENT_PROMPT_VERSION,
        decisions: [],
        decidedPages: 0,
        errorPages: 0,
      },
      update: {
        criteria: criteriaJson,
        promptVersion: PAGE_ASSESSMENT_PROMPT_VERSION,
      },
    });

    await writeJsonFile(resolveFileName(`03.1-criteria-${runTag}`), criteria);

    return {
      criteria,
      promptVersion: PAGE_ASSESSMENT_PROMPT_VERSION,
      decisions: [],
    };
  }

  private async loadResume(jobId: string): Promise<PageAssessmentState> {
    const stored = await this.prismaService.researchStage03.findUnique({
      where: { jobId },
    });

    if (!stored) {
      throw new Error(
        `Cannot resume 03: no saved stage 03 state for job ${jobId}.`,
      );
    }

    if (!stored.criteria || !stored.promptVersion) {
      throw new Error(
        `Cannot resume 03: criteria or prompt version is missing for job ${jobId}.`,
      );
    }

    if (stored.promptVersion !== PAGE_ASSESSMENT_PROMPT_VERSION) {
      throw new Error(
        `Cannot resume 03: saved prompt version "${stored.promptVersion}" is not executable; current version is "${PAGE_ASSESSMENT_PROMPT_VERSION}".`,
      );
    }

    const criteria = studyCriteriaSchema.parse(stored.criteria);
    const decisions = Array.isArray(stored.decisions)
      ? (stored.decisions as PageAssessmentDecision[])
      : [];

    return {
      criteria,
      promptVersion: stored.promptVersion,
      decisions,
    };
  }

  private async saveCheckpoint(
    data: PageAssessmentInput,
    jobId: string,
    decisions: ReadonlyMap<number, PageAssessmentDecision>,
    executionToken?: string,
  ): Promise<PageAssessmentResult> {
    const ordered = this.orderedDecisions(decisions);
    const result = buildResultFromDecisions(data, ordered);
    const { decidedPages, errorPages } = countDecisions(ordered);
    const persistedDecisions = structuredClone(
      ordered,
    ) as unknown as Prisma.InputJsonValue;
    const persistedResult = structuredClone(
      result,
    ) as unknown as Prisma.InputJsonValue;

    const checkpoint = {
      decisions: persistedDecisions,
      result: persistedResult,
      decidedPages,
      errorPages,
    };

    if (!executionToken) {
      await this.prismaService.researchStage03.update({
        where: { jobId },
        data: checkpoint,
      });
      return result;
    }

    await this.prismaService.$transaction(async (tx) => {
      const lease = await tx.research.updateMany({
        where: {
          id: jobId,
          executionToken,
          executionLeaseUntil: { gt: new Date() },
        },
        data: {
          executionLeaseUntil: new Date(Date.now() + EXECUTION_LEASE_MS),
          lastHeartbeatAt: new Date(),
        },
      });

      if (lease.count !== 1) {
        throw new Error(
          `Execution lease lost for job ${jobId}; this process must stop.`,
        );
      }

      await tx.researchStage03.update({
        where: { jobId },
        data: checkpoint,
      });
    });

    return result;
  }

  private orderedDecisions(
    decisions: ReadonlyMap<number, PageAssessmentDecision>,
  ): PageAssessmentDecision[] {
    return Array.from(decisions.values()).sort(
      (left, right) => left.pageIndex - right.pageIndex,
    );
  }
}
