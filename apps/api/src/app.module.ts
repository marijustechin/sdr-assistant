import { Module } from '@nestjs/common'

import { HealthModule } from './modules/health/health.module.js'
import { PrismaModule } from './modules/prisma/prisma.module.js'
import { ProductsModule } from './modules/products/products.module.js'
import { ResearchModule } from './modules/research/research.module.js'

@Module({
  imports: [PrismaModule, HealthModule, ProductsModule, ResearchModule],
})
export class AppModule {}
