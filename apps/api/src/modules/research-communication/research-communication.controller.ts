import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UpdateResearchEmailAccountDto } from './dto/update-research-email-account.dto.js';
import { UpdateResearchInitialEmailDto } from './dto/update-research-initial-email.dto.js';
import { ResearchCommunicationService } from './research-communication.service.js';
import { parseRecipientQueueQuery } from './research-recipient-queue.query.js';

/**
 * Research-specific communication settings and the prepared recipient queue.
 *
 * These endpoints manage configuration and derived data only. They never send
 * email, open a mailbox, test SMTP/IMAP, synchronize a mailbox or return
 * credential material. A prepared recipient is not eligible, authorized or sent.
 */
@Controller('research/:jobId/communication')
export class ResearchCommunicationController {
  constructor(
    private readonly researchCommunicationService: ResearchCommunicationService,
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
}
