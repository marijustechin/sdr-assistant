import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UpdateResearchEmailAccountDto } from './dto/update-research-email-account.dto.js';
import { UpdateResearchInitialEmailDto } from './dto/update-research-initial-email.dto.js';
import { ResearchAttachmentsService } from './research-attachments.service.js';
import { ResearchCommunicationService } from './research-communication.service.js';
import { parseRecipientQueueQuery } from './research-recipient-queue.query.js';

/** Percent-decoded header value; a malformed encoding is kept verbatim. */
function decodeHeader(value: string | undefined): string {
  if (value === undefined) return '';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Research-specific communication settings, the prepared recipient queue and
 * private initial-email attachments.
 *
 * These endpoints manage configuration and derived data only. They never send
 * email, open a mailbox, test SMTP/IMAP, synchronize a mailbox or return
 * credential material. A prepared recipient is not eligible, authorized or sent.
 * Attachment endpoints expose metadata only; the file bytes are never returned.
 */
@Controller('research/:jobId/communication')
export class ResearchCommunicationController {
  constructor(
    private readonly researchCommunicationService: ResearchCommunicationService,
    private readonly researchAttachmentsService: ResearchAttachmentsService,
  ) {}

  @Get()
  getCommunicationSettings(@Param('jobId') jobId: string) {
    return this.researchCommunicationService.getCommunicationSettings(jobId);
  }

  @Patch('email-account')
  updateEmailAccountAssignment(
    @Param('jobId') jobId: string,
    @Body() dto: UpdateResearchEmailAccountDto,
  ) {
    return this.researchCommunicationService.updateEmailAccountAssignment(
      jobId,
      dto.emailAccountId,
    );
  }

  @Patch('initial-email')
  updateInitialEmail(
    @Param('jobId') jobId: string,
    @Body() dto: UpdateResearchInitialEmailDto,
  ) {
    return this.researchCommunicationService.updateInitialEmail(
      jobId,
      dto.subject,
      dto.body,
    );
  }

  @Get('recipient-queue')
  getRecipientQueue(
    @Param('jobId') jobId: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.researchCommunicationService.getRecipientQueue(
      jobId,
      parseRecipientQueueQuery({ q, page, pageSize }),
    );
  }

  @Post('recipient-queue/prepare')
  prepareRecipientQueue(@Param('jobId') jobId: string) {
    return this.researchCommunicationService.prepareRecipientQueue(jobId);
  }

  /** Metadata and the active limits only; never the stored file bytes. */
  @Get('attachments')
  listAttachments(@Param('jobId') jobId: string) {
    return this.researchAttachmentsService.list(jobId);
  }

  /**
   * Accepts one raw `application/octet-stream` body. The file name and media
   * type travel in headers because the body is the file itself. Metadata is
   * returned; the content is never echoed.
   */
  @Post('attachments')
  uploadAttachment(
    @Param('jobId') jobId: string,
    @Body() content: unknown,
    @Headers('x-attachment-filename') filename?: string,
    @Headers('x-attachment-mime-type') mimeType?: string,
  ) {
    return this.researchAttachmentsService.upload(jobId, {
      filename: decodeHeader(filename),
      mimeType: decodeHeader(mimeType),
      content,
    });
  }

  @Delete('attachments/:attachmentId')
  async removeAttachment(
    @Param('jobId') jobId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.researchAttachmentsService.remove(jobId, attachmentId);

    return { removed: true };
  }
}
