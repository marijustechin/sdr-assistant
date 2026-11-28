import { Module } from '@nestjs/common';

import { ResearchAttachmentsService } from './research-attachments.service.js';
import { ResearchCommunicationController } from './research-communication.controller.js';
import { ResearchCommunicationService } from './research-communication.service.js';

@Module({
  controllers: [ResearchCommunicationController],
  providers: [ResearchCommunicationService, ResearchAttachmentsService],
})
export class ResearchCommunicationModule {}
