import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  return connectionString
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({ adapter: new PrismaPg({ connectionString: getConnectionString() }) })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    await this.$queryRaw`SELECT 1`
    this.logger.log('Connected to PostgreSQL')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
