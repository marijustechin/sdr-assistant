import { Module } from '@nestjs/common';

import { ResearchCommunicationController } from './research-communication.controller.js';
import { ResearchCommunicationService } from './research-communication.service.js';

@Module({
  controllers: [ResearchCommunicationController],
  providers: [ResearchCommunicationService],
})
export class ResearchCommunicationModule {}
