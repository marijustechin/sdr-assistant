import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrismaQualificationStore } from '../lead-qualification/lead-qualification.repository.js';
import {
  ContactDiscoveryAutomationService,
  CONTACT_DISCOVERY_RUNTIME,
} from './contact-discovery.automation.js';
import { createLiveContactDiscoveryPipeline } from './contact-discovery.live.js';
import { ContactDiscoveryRuntime } from './contact-discovery.runtime.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: CONTACT_DISCOVERY_RUNTIME,
      useFactory: (prisma: PrismaService): ContactDiscoveryRuntime =>
        new ContactDiscoveryRuntime(
          new PrismaQualificationStore(prisma),
          createLiveContactDiscoveryPipeline(),
        ),
      inject: [PrismaService],
    },
    ContactDiscoveryAutomationService,
  ],
  exports: [ContactDiscoveryAutomationService],
})
export class ContactDiscoveryModule {}
