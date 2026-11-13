import { Injectable, Logger } from '@nestjs/common';

import type { CreateResearchDto } from './dto/create-research.dto.js';

import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';

@Injectable()
export class ResearchService {
  constructor(
    private readonly productIdentificationService: ProductIdentificationService,
  ) {}

  private readonly logger = new Logger(ResearchService.name);

  async start(dto: CreateResearchDto): Promise<{ status: 'completed' }> {
    const product = await this.productIdentificationService.identify(dto);

    return { status: 'completed' };
  }
}
