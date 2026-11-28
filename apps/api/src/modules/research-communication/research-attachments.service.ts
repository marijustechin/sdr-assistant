import { createHash } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  formatAttachmentSize,
  readAttachmentLimits,
  type AttachmentLimits,
} from './attachment-limits.js';

export type ResearchAttachmentMetadata = {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: string;
};

export type ResearchAttachmentList = {
  readonly limits: AttachmentLimits;
  readonly items: ResearchAttachmentMetadata[];
};

export type ResearchAttachmentUpload = {
  /** Raw request header value; decoded and sanitised by the service. */
  readonly filename: string;
  readonly mimeType: string | undefined;
  /** Parsed raw request body. Validated here, never trusted from the transport. */
  readonly content: unknown;
};

export const MAX_ATTACHMENT_FILENAME_LENGTH = 200;
const MAX_MIME_TYPE_LENGTH = 200;
const DEFAULT_MIME_TYPE = 'application/octet-stream';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MIME_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

const ATTACHMENT_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  createdAt: true,
} as const satisfies Prisma.ResearchAttachmentSelect;

type ResearchAttachmentRow = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
};

function toMetadata(row: ResearchAttachmentRow): ResearchAttachmentMetadata {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * A file name is display metadata only: the content is stored in the database
 * row and never written to a path, so no value here can traverse the
 * filesystem. Path separators, control characters and the bare `.`/`..` names
 * are still rejected so a stored name can never be mistaken for a path.
 */
function normaliseFilename(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed === '') {
    throw new BadRequestException('An attachment file name is required.');
  }

  if (trimmed.length > MAX_ATTACHMENT_FILENAME_LENGTH) {
    throw new BadRequestException(
      `An attachment file name must be at most ${MAX_ATTACHMENT_FILENAME_LENGTH} characters.`,
    );
  }

  if (
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    CONTROL_CHARACTERS.test(trimmed)
  ) {
    throw new BadRequestException('The attachment file name is invalid.');
  }

  return trimmed;
}

/** Keeps a sane media type; anything malformed becomes a generic binary type. */
function normaliseMimeType(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();

  if (trimmed === '' || trimmed.length > MAX_MIME_TYPE_LENGTH) {
    return DEFAULT_MIME_TYPE;
  }

  return MIME_TYPE_PATTERN.test(trimmed)
    ? trimmed.toLowerCase()
    : DEFAULT_MIME_TYPE;
}

/**
 * Private, research-owned initial-email attachments.
 *
 * Metadata and file bytes live in one PostgreSQL row, so an upload and its
 * metadata commit atomically and a removal deletes both. The API exposes
 * metadata only: `content` is never selected by a read model, returned by a
 * controller or served over HTTP. Nothing is written to the filesystem, so there
 * is no path to traverse and no public directory to misconfigure. Files survive
 * an application restart and are included in a database backup.
 */
@Injectable()
export class ResearchAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Metadata plus the active limits; never the file bytes. */
  async list(researchId: string): Promise<ResearchAttachmentList> {
    await this.requireResearch(researchId);

    const rows = await this.prisma.researchAttachment.findMany({
      where: { researchId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: ATTACHMENT_SELECT,
    });

    return {
      limits: readAttachmentLimits(),
      items: rows.map(toMetadata),
    };
  }

  /**
   * Validates and stores one attachment. The count and total checks run inside
   * the same transaction as the insert so a concurrent upload cannot exceed the
   * limits silently.
   */
  async upload(
    researchId: string,
    upload: ResearchAttachmentUpload,
  ): Promise<ResearchAttachmentMetadata> {
    await this.requireResearch(researchId);

    const limits = readAttachmentLimits();
    const filename = normaliseFilename(upload.filename);
    const mimeType = normaliseMimeType(upload.mimeType);

    if (!Buffer.isBuffer(upload.content)) {
      throw new BadRequestException(
        'The attachment must be uploaded as binary content.',
      );
    }

    // A fresh ArrayBuffer-backed view is what Prisma's `Bytes` column accepts.
    const content = Uint8Array.from(upload.content);

    if (content.length === 0) {
      throw new BadRequestException('The attachment is empty.');
    }

    if (content.length > limits.maxFileBytes) {
      throw new PayloadTooLargeException(
        `An attachment must be at most ${formatAttachmentSize(limits.maxFileBytes)}.`,
      );
    }

    const sha256 = createHash('sha256').update(content).digest('hex');

    const row = await this.prisma.$transaction(async (transaction) => {
      const [count, aggregate] = await Promise.all([
        transaction.researchAttachment.count({ where: { researchId } }),
        transaction.researchAttachment.aggregate({
          where: { researchId },
          _sum: { sizeBytes: true },
        }),
      ]);

      if (count >= limits.maxAttachments) {
        throw new BadRequestException(
          `A research can have at most ${limits.maxAttachments} attachments.`,
        );
      }

      const totalBytes = aggregate._sum.sizeBytes ?? 0;

      if (totalBytes + content.length > limits.maxTotalBytes) {
        throw new PayloadTooLargeException(
          `The attachments of one research must total at most ${formatAttachmentSize(limits.maxTotalBytes)}.`,
        );
      }

      return transaction.researchAttachment.create({
        data: {
          researchId,
          filename,
          mimeType,
          sizeBytes: content.length,
          sha256,
          content,
        },
        select: ATTACHMENT_SELECT,
      });
    });

    return toMetadata(row);
  }

  /** Removes one attachment; an id from another research is not found. */
  async remove(researchId: string, attachmentId: string): Promise<void> {
    await this.requireResearch(researchId);

    const existing = await this.prisma.researchAttachment.findFirst({
      where: { id: attachmentId, researchId },
      select: { id: true },
    });

    if (existing === null) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    await this.prisma.researchAttachment.delete({ where: { id: existing.id } });
  }

  private async requireResearch(jobId: string): Promise<void> {
    const research = await this.prisma.research.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (research === null) {
      throw new NotFoundException(`Research ${jobId} not found`);
    }
  }
}
