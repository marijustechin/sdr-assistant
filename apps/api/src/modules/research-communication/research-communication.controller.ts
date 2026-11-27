import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { UpdateResearchEmailAccountDto } from './dto/update-research-email-account.dto.js';
import { ResearchCommunicationService } from './research-communication.service.js';

/**
 * Research-specific communication settings.
 *
 * These endpoints manage configuration only. They never send email, open a
 * mailbox, test SMTP/IMAP or return credential material.
 */
@Controller('research/:jobId/communication')
export class ResearchCommunicationController {
  constructor(
    private readonly researchCommunicationService: ResearchCommunicationService,
  ) {}

  @Get()
  getEmailAccountAssignment(@Param('jobId') jobId: string) {
    return this.researchCommunicationService.getEmailAccountAssignment(jobId);
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
}
