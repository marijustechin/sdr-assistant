import 'dotenv/config'
import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify'

import { AppModule } from './app.module.js'
import { attachmentRequestBodyLimitBytes } from './modules/research-communication/attachment-limits.js'

const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '0.0.0.0'

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: true }),
)

app.enableShutdownHooks()
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)

// Attachment uploads send the file itself as the request body. Only this one
// media type is parsed as a buffer, and its body limit is the configured
// per-file limit plus envelope headroom; the JSON and form parsers keep their
// normal limits. The service validates the size again and rejects an empty body.
app
  .getHttpAdapter()
  .getInstance()
  .addContentTypeParser(
    'application/octet-stream',
    {
      parseAs: 'buffer',
      bodyLimit: attachmentRequestBodyLimitBytes(),
    },
    (_request, body, done) => {
      done(null, body)
    },
  )

await app.listen({ port, host })

const logger = new Logger('Bootstrap')
logger.log(`API listening on http://localhost:${port}`)
