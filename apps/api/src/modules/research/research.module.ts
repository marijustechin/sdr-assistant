import { Module } from '@nestjs/common';

import { ResearchController } from './research.controller.js';
import { ResearchService } from './research.service.js';
import { ProductIdentificationService } from './stages/01-product-identification/product-identification.service.js';
import { PageCollectionService } from './stages/02-page-collection/page-collection.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { PageAssessmentService } from './stages/03-page-assessment/page-assessment.service.js';
import { CompanyProfilingService } from './stages/04-company-profiling/company-profiling.service.js';

@Module({
  controllers: [ResearchController],
  providers: [
    ResearchService,
    ProductIdentificationService,
    PageCollectionService,
    PageAssessmentService,
    CompanyProfilingService,
    SettingsService,
  ],
})
export class ResearchModule {}
