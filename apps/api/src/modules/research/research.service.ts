import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import countries from 'i18n-iso-countries';

import type { Prisma } from '../../generated/prisma/client.js';
import type { CreateResearchDto } from './dto/create-research.dto.js';

import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PageCollectionService } from './stages/02-page-collection/page-collection.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { PageAssessmentService } from './stages/03-page-assessment/page-assessment.service.js';
import { PAGE_ASSESSMENT_PROMPT_VERSION } from './stages/03-page-assessment/page-assessment.prompt.js';
import { languageByCountry } from './lib/utils.js';
import { CompanyProfilingService } from './stages/04-company-profiling/company-profiling.service.js';
import {
  ContactDiscoveryAutomationService,
  STAGE05_PENDING_STAGE,
} from '../contact-discovery-pipeline/contact-discovery.automation.js';
import {
  buildFinalResearchResult,
  type FinalResearchResult,
} from './final-result.js';
import { PageForAssessment } from './types.js';
import { IdentifiedProduct } from './stages/01-product-identification/product-identification.schema.js';

/**
 * How long a run may go without any stage update before it is considered dead.
 *
 * Every stage reports progress: identification four times, page collection once
 * per page, discovery once per domain. A live run therefore never stays silent
 * this long, while a crashed or hung one is left `RUNNING` forever and blocks
 * the duplicate check in `start()`.
 */
const STALE_RUN_MS = 5 * 60 * 1000;
const EXECUTION_LEASE_MS = 5 * 60 * 1000;

@Injectable()
export class ResearchService implements OnModuleInit {
  constructor(
    private readonly productIdentificationService: ProductIdentificationService,
    private readonly pageCollectionService: PageCollectionService,
    private readonly pageAssessmentService: PageAssessmentService,
    private readonly companyProfilingService: CompanyProfilingService,
    private readonly prismaService: PrismaService,
    private readonly settingsService: SettingsService,
    @Optional()
    private readonly contactDiscoveryAutomation?: ContactDiscoveryAutomationService,
  ) {}

  private readonly logger = new Logger(ResearchService.name);

  /**
   * A run that survived a restart cannot be resumed: its state lives in the
   * process that died. Mark such rows INTERRUPTED at boot so the list never
   * shows a phantom "Running" job.
   */
  async onModuleInit(): Promise<void> {
    await this.failStaleRuns();
  }

  async start(dto: CreateResearchDto) {
    // Clear runs that died with a previous process, otherwise the duplicate
    // check below hands back a job that will never finish.
    await this.failStaleRuns();

    const existingProduct = await this.prismaService.product.findUnique({
      where: {
        id: dto.productId,
      },
    });

    if (!existingProduct) throw new NotFoundException('Product not found');

    const activeResearch = await this.prismaService.research.findFirst({
      where: {
        productId: dto.productId,
        country: dto.country,
        status: {
          in: ['QUEUED', 'RUNNING'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (activeResearch)
      return { jobId: activeResearch.id, status: activeResearch.status };

    const research = await this.prismaService.research.create({
      data: {
        productId: dto.productId,
        country: dto.country,
      },
      select: {
        id: true,
        status: true,
      },
    });

    void this.runResearch(research.id, dto).catch((error: unknown) => {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    });

    return { jobId: research.id, status: research.status };
  }

  async getById(jobId: string) {
    await this.failStaleRuns();

    const job = await this.prismaService.research.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) throw new NotFoundException('Job not found');

    const {
      executionToken: _executionToken,
      executionLeaseUntil: _executionLeaseUntil,
      ...safeJob
    } = job;

    return {
      ...safeJob,
      stage: publicStage(safeJob.stage),
    };
  }

  async getAll() {
    await this.failStaleRuns();

    const researches = await this.prismaService.research.findMany();

    return researches.map(
      ({
        executionToken: _executionToken,
        executionLeaseUntil: _executionLeaseUntil,
        ...safeJob
      }) => ({
        ...safeJob,
        stage: publicStage(safeJob.stage),
      }),
    );
  }

  /**
   * Marks runs that stopped reporting progress as INTERRUPTED.
   *
   * `lastHeartbeatAt` is written with every stage update; rows created before
   * the heartbeat existed fall back to `updatedAt`.
   */
  private async failStaleRuns(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_RUN_MS);

    try {
      const { count } = await this.prismaService.research.updateMany({
        where: {
          status: { in: ['QUEUED', 'RUNNING'] },
          OR: [
            { lastHeartbeatAt: { lt: cutoff } },
            { lastHeartbeatAt: null, updatedAt: { lt: cutoff } },
          ],
        },
        data: {
          status: 'INTERRUPTED',
          stage: null,
          error: 'Interrupted: no progress for 5 minutes',
          executionToken: null,
          executionLeaseUntil: null,
        },
      });

      if (count > 0) {
        this.logger.warn(`Marked ${count} stalled research run(s) INTERRUPTED`);
      }
    } catch (error) {
      this.logger.error(
        `Stalled run sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * ////////////////////////////////////////////////
   * @param jobId
   * @param dto
   */
  private async runResearch(
    jobId: string,
    dto: CreateResearchDto,
  ): Promise<void> {
    const executionToken = randomUUID();

    try {
      const resultsPerQuery = await this.settingsService.getNumber(
        'research.pageCollection.resultsPerQuery',
      );
      await this.prismaService.research.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          stage: 'product-identification',
          lastHeartbeatAt: new Date(),
          executionToken,
          executionLeaseUntil: new Date(Date.now() + EXECUTION_LEASE_MS),
        },
      });

      const updateStage = async (stage: string): Promise<void> => {
        const { count } = await this.prismaService.research.updateMany({
          where: { id: jobId, executionToken },
          data: {
            stage,
            lastHeartbeatAt: new Date(),
            executionLeaseUntil: new Date(Date.now() + EXECUTION_LEASE_MS),
          },
        });

        if (count !== 1) {
          throw new Error(
            `Execution lease lost for job ${jobId}; this process must stop.`,
          );
        }
      };

      // Research variables
      const countryCode = countries.getAlpha2Code(dto.country, 'en') ?? 'xx';
      const targetLanguage = languageByCountry[countryCode.toUpperCase()];

      if (!targetLanguage) {
        throw new Error(`Target language is not configured for ${dto.country}`);
      }

      // 01. Product identification
      const identifiedProduct =
        await this.productIdentificationService.identify(
          dto,
          targetLanguage,
          jobId,
          updateStage,
        );

      // 02. Page collection
      const collectedPages = await this.pageCollectionService.collect(
        dto,
        identifiedProduct,
        targetLanguage,
        jobId,
        updateStage,
        resultsPerQuery,
      );

      // 03. Page assessment
      const assessedPages = await this.pageAssessmentService.assessPages(
        {
          targetCountry: dto.country,
          targetLanguage,
          product: {
            productName: identifiedProduct.product.productName,
            categoryName: identifiedProduct.product.categoryName,
            generalCategoryName: identifiedProduct.product.generalCategoryName,
            description: dto.description,
          },
          pages: collectedPages,
        },
        jobId,
        updateStage,
        executionToken,
      );

      // 04. Company profiling
      const profiledCompanies = await this.companyProfilingService.profile(
        assessedPages,
        updateStage,
      );

      await this.completeResearch(
        jobId,
        executionToken,
        buildFinalResearchResult({ profiling: profiledCompanies, resultsPerQuery }),
      );
      await this.startAutomaticStage05(jobId);
    } catch (error) {
      await this.prismaService.research.updateMany({
        where: { id: jobId, executionToken },
        data: {
          status: 'FAILED',
          stage: null,
          executionToken: null,
          executionLeaseUntil: null,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Starts Stage 05 after the Stage 04 result is committed. The automation
   * service contains its own failure handling, so a Stage 05 failure can never
   * turn a successfully completed Stage 04 run into a failed one.
   */
  private async startAutomaticStage05(jobId: string): Promise<void> {
    if (this.contactDiscoveryAutomation === undefined) return;
    try {
      await this.contactDiscoveryAutomation.afterStage04Completed(jobId);
    } catch (error) {
      this.logger.error(
        `Stage 05 automation failed after Stage 04 completion for ${jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Persists the final result and the COMPLETED state in one write.
   *
   * The conditional `executionToken` filter is the ownership safeguard: a stale or
   * superseded executor matches no row, writes nothing and throws, so it can never
   * overwrite another execution's result. Because the result and the status are set
   * by the same statement, a failure leaves the row running (and then FAILED from the
   * caller's catch) rather than falsely completed.
   */
  private async completeResearch(
    jobId: string,
    executionToken: string,
    result: FinalResearchResult,
  ): Promise<void> {
    const completed = await this.prismaService.research.updateMany({
      where: { id: jobId, executionToken },
      data: {
        status: 'COMPLETED',
        stage: STAGE05_PENDING_STAGE,
        executionToken: null,
        executionLeaseUntil: null,
        result: asJson(result),
      },
    });

    if (completed.count !== 1) {
      throw new Error(
        `Execution lease lost for job ${jobId}; this process must stop.`,
      );
    }
  }

  /**
   * Resumes a stopped stage 03 without re-running 01/02 or regenerating criteria.
   *
   * The execution lease is claimed atomically. A second click (or a second API
   * process) gets 409 until the lease expires; the old process loses its lease
   * and its next stage/checkpoint write is rejected.
   */
  async resume(jobId: string) {
    const research = await this.prismaService.research.findUnique({
      where: { id: jobId },
      include: {
        product: true,
        stage01Result: true,
        stage02Result: true,
        stage03Result: true,
      },
    });

    if (!research) throw new NotFoundException('Job not found');

    if (research.status === 'COMPLETED') {
      throw new ConflictException('Research is already completed');
    }

    if (!research.stage01Result || !research.stage02Result) {
      throw new BadRequestException(
        'Cannot resume: stage 01 or stage 02 result is missing',
      );
    }

    if (
      !research.stage03Result?.criteria ||
      !research.stage03Result.promptVersion
    ) {
      throw new BadRequestException(
        'Cannot resume: stage 03 criteria or prompt version is missing',
      );
    }

    if (
      research.stage03Result.promptVersion !== PAGE_ASSESSMENT_PROMPT_VERSION
    ) {
      throw new BadRequestException(
        `Cannot resume: stage 03 prompt version "${research.stage03Result.promptVersion}" is not executable; current version is "${PAGE_ASSESSMENT_PROMPT_VERSION}"`,
      );
    }

    if (!Array.isArray(research.stage02Result.result)) {
      throw new BadRequestException(
        'Cannot resume: stage 02 result is not a page list',
      );
    }

    const countryCode = countries.getAlpha2Code(research.country, 'en') ?? 'xx';
    const targetLanguage = languageByCountry[countryCode.toUpperCase()];

    if (!targetLanguage) {
      throw new BadRequestException(
        `Cannot resume: target language is not configured for ${research.country}`,
      );
    }

    const identifiedProduct = research.stage01Result
      .identifiedProduct as unknown as IdentifiedProduct;

    const data = {
      targetCountry: research.country,
      targetLanguage,
      product: {
        productName: identifiedProduct.productName,
        categoryName: identifiedProduct.categoryName,
        generalCategoryName: identifiedProduct.generalCategoryName,
        description: research.product.description,
      },
      pages: research.stage02Result.result as unknown as PageForAssessment[],
    };

    const executionToken = randomUUID();
    const now = new Date();
    const claimed = await this.prismaService.research.updateMany({
      where: {
        id: jobId,
        status: { not: 'COMPLETED' },
        OR: [
          { executionLeaseUntil: null },
          { executionLeaseUntil: { lt: now } },
        ],
      },
      data: {
        status: 'RUNNING',
        stage: '03.1 Resuming assessment...',
        lastHeartbeatAt: now,
        executionToken,
        executionLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS),
        error: null,
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictException(
        'Research is already running in another executor',
      );
    }

    void this.runResume(jobId, executionToken, data).catch((error: unknown) => {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    });

    return { jobId, status: 'RUNNING' as const };
  }

  private async runResume(
    jobId: string,
    executionToken: string,
    data: {
      targetCountry: string;
      targetLanguage: string;
      product: {
        productName: string;
        categoryName: string;
        generalCategoryName: string;
        description: string;
      };
      pages: PageForAssessment[];
    },
  ): Promise<void> {
    const updateStage = async (stage: string): Promise<void> => {
      const { count } = await this.prismaService.research.updateMany({
        where: { id: jobId, executionToken },
        data: {
          stage,
          lastHeartbeatAt: new Date(),
          executionLeaseUntil: new Date(Date.now() + EXECUTION_LEASE_MS),
        },
      });

      if (count !== 1) {
        throw new Error(
          `Execution lease lost for job ${jobId}; this process must stop.`,
        );
      }
    };

    try {
      await updateStage('03.1 Resuming assessment...');

      const assessedPages = await this.pageAssessmentService.resumePages(
        data,
        jobId,
        updateStage,
        executionToken,
      );

      const profiledCompanies = await this.companyProfilingService.profile(
        assessedPages,
        updateStage,
      );

      await this.completeResearch(
        jobId,
        executionToken,
        buildFinalResearchResult({ profiling: profiledCompanies }),
      );
      await this.startAutomaticStage05(jobId);
    } catch (error) {
      await this.prismaService.research.updateMany({
        where: { id: jobId, executionToken },
        data: {
          status: 'FAILED',
          stage: null,
          executionToken: null,
          executionLeaseUntil: null,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

/**
 * Stores a plain JSON result in the `result` column.
 *
 * Prisma's JSON input type requires a string index signature, which the result
 * interfaces do not declare. The value is already plain JSON (`null`s, strings,
 * numbers, arrays), so the cast bridges the type only, not the data.
 */
function publicStage(stage: string | null): string | null {
  return stage === STAGE05_PENDING_STAGE ? null : stage;
}

function asJson(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
