import { Module } from '@nestjs/common';

import { ResearchController } from './research.controller.js';
import { ResearchService } from './research.service.js';
import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';
import { CompanyDiscoveryService } from './stages/02-company-discovery/company-discovery.service.js';

@Module({
  controllers: [ResearchController],
  providers: [
    ResearchService,
    ProductIdentificationService,
    CompanyDiscoveryService,
  ],
})
export class ResearchModule {}
