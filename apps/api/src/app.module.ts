import { Module } from '@nestjs/common'

import { EmailAccountsModule } from './modules/email-accounts/email-accounts.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { LeadQualificationModule } from './modules/lead-qualification/lead-qualification.module.js'
import { PrismaModule } from './modules/prisma/prisma.module.js'
import { ProductsModule } from './modules/products/products.module.js'
import { ResearchCommunicationModule } from './modules/research-communication/research-communication.module.js'
import { ResearchModule } from './modules/research/research.module.js'
import { SettingsModule } from './modules/settings/settings.module.js'

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ProductsModule,
    EmailAccountsModule,
    ResearchModule,
    ResearchCommunicationModule,
    SettingsModule,
    LeadQualificationModule,
  ],
})
export class AppModule {}
