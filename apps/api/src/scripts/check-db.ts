import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

try {
  const [{ result }] = await prisma.$queryRaw<{ result: number }[]>`
    SELECT 1 AS result
  `
  const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`
    SELECT version() AS version
  `

  if (result !== 1) {
    throw new Error(`Unexpected query result: ${String(result)}`)
  }

  console.log('PostgreSQL connection OK')
  console.log(version.split(',')[0])
} finally {
  await prisma.$disconnect()
}
