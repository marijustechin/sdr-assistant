import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { CreateResearchDto } from './dto/create-research.dto.js';

import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PageCollectionService } from './stages/02-page-collection/page-collection.service.js';
import { CompanyDiscoveryService } from './stages/03-company-discovery/company-discovery.service.js';

/**
 * How long a run may go without any stage update before it is considered dead.
 *
 * Every stage reports progress: identification four times, page collection once
 * per page, discovery once per domain. A live run therefore never stays silent
 * this long, while a crashed or hung one is left `RUNNING` forever and blocks
 * the duplicate check in `start()`.
 */
const STALE_RUN_MS = 5 * 60 * 1000;

@Injectable()
export class ResearchService implements OnModuleInit {
  constructor(
    private readonly productIdentificationService: ProductIdentificationService,
    private readonly pageCollectionService: PageCollectionService,
    private readonly companyDiscoveryService: CompanyDiscoveryService,
    private readonly prismaService: PrismaService,
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
    const job = await this.prismaService.research.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) throw new NotFoundException('Job not found');

    return job;
  }

  async getAll() {
    const researches = await this.prismaService.research.findMany();
    return researches;
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

  private async runResearch(
    jobId: string,
    dto: CreateResearchDto,
  ): Promise<void> {
    try {
      await this.prismaService.research.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          stage: 'product-identification',
          lastHeartbeatAt: new Date(),
        },
      });

      const updateStage = async (stage: string): Promise<void> => {
        await this.prismaService.research.update({
          where: { id: jobId },
          data: { stage, lastHeartbeatAt: new Date() },
        });
      };

      // 01. Product identification
      const identifiedProduct =
        await this.productIdentificationService.identify(dto, updateStage);

      // 02. Page collection ///////////////////////////////////////////////
      const collectedPages = await this.pageCollectionService.collect(
        dto,
        identifiedProduct,
        updateStage,
      );

      // 03. Company discovery
      const companies = await this.companyDiscoveryService.discover(
        {
          targetCountry: dto.country,
          product: identifiedProduct.product,
          pages: collectedPages,
        },
        updateStage,
      );

      await this.prismaService.research.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          stage: null,
          result: asJson({ companies }),
        },
      });
    } catch (error) {
      await this.prismaService.research.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
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
function asJson(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
