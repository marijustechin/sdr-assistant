import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { CreateResearchDto } from './dto/create-research.dto.js';

import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompanyDiscoveryService } from './stages/02-company-discovery/company-discovery.service.js';
import { readIdentificationFixture } from './lib/research-fixture.lib.js';

@Injectable()
export class ResearchService {
  constructor(
    private readonly productIdentificationService: ProductIdentificationService,
    private readonly companyDiscoveryService: CompanyDiscoveryService,
    private readonly prismaService: PrismaService,
  ) {}

  private readonly logger = new Logger(ResearchService.name);

  async start(dto: CreateResearchDto) {
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
        },
      });
      /////////////// laikinas isjungimas /////////////////////////////////////////////////////////
      // const result = await this.productIdentificationService.identify(
      //   dto,
      //   async (stage) => {
      //     await this.prismaService.research.update({
      //       where: { id: jobId },
      //       data: { stage },
      //     });
      //   },
      // );

      // ///////////////// laikino isjungimo pabaiga //////////////////////////////////////////////

      const stage1 = await readIdentificationFixture('abachi-lt');

      const result = await this.companyDiscoveryService.discover(
        stage1,
        async (stage) => {
          await this.prismaService.research.update({
            where: { id: jobId },
            data: { stage },
          });
        },
      );

      await this.prismaService.research.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          stage: null,
          result,
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
