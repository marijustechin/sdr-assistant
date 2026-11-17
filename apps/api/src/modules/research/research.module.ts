import { Module } from '@nestjs/common';

import { ResearchController } from './research.controller.js';
import { ResearchService } from './research.service.js';
import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';
import { PageCollectionService } from './stages/02-page-collection/page-collection.service.js';
import { CompanyDiscoveryService } from './stages/03-company-discovery/company-discovery.service.js';

@Module({
  controllers: [ResearchController],
  providers: [
    ResearchService,
    ProductIdentificationService,
    PageCollectionService,
    CompanyDiscoveryService
  ],
})
export class ResearchModule {}
