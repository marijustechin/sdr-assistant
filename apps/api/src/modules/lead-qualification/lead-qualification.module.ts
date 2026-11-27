import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

import { llmChat } from '../research/lib/llm-chat.js';
import { DEFAULT_LEAD_QUALIFICATION_LIMITS } from './lead-qualification.constants.js';
import { LeadQualificationController } from './lead-qualification.controller.js';
import {
  ContactDiscoveryService,
  ExaSearchProvider,
  FirecrawlScraper,
  SafePageFetcher,
} from './lead-qualification.discovery.js';
import {
  LEAD_QUALIFICATION_ENGINE,
  LeadQualificationEngine,
} from './lead-qualification.engine.js';
import { SafeHttpClient } from './lead-qualification.http.js';
import {
  LEAD_QUALIFICATION_STORE,
  PrismaQualificationStore,
} from './lead-qualification.repository.js';
import {
  LlmSemanticAssessor,
  type SemanticAssessor,
} from './lead-qualification.semantic.js';
import { LeadQualificationService } from './lead-qualification.service.js';
import { WebsiteValidator } from './lead-qualification.website.js';
import type { LeadQualificationLimits } from './lead-qualification.types.js';

export const LEAD_QUALIFICATION_LIMITS = Symbol('LEAD_QUALIFICATION_LIMITS');
export const LEAD_QUALIFICATION_WEBSITE = Symbol('LEAD_QUALIFICATION_WEBSITE');
export const LEAD_QUALIFICATION_DISCOVERY = Symbol(
  'LEAD_QUALIFICATION_DISCOVERY',
);
export const LEAD_QUALIFICATION_SEMANTIC = Symbol(
  'LEAD_QUALIFICATION_SEMANTIC',
);
export const LEAD_QUALIFICATION_HTTP = Symbol('LEAD_QUALIFICATION_HTTP');

@Module({
  controllers: [LeadQualificationController],
  providers: [
    {
      provide: LEAD_QUALIFICATION_LIMITS,
      useValue: DEFAULT_LEAD_QUALIFICATION_LIMITS,
    },
    {
      provide: LEAD_QUALIFICATION_HTTP,
      useFactory: (limits: LeadQualificationLimits): SafeHttpClient =>
        new SafeHttpClient({
          timeoutMs: limits.websiteTimeoutMs,
          maxRedirects: limits.websiteMaxRedirects,
          maxBodyBytes: limits.websiteMaxBodyBytes,
        }),
      inject: [LEAD_QUALIFICATION_LIMITS],
    },
    {
      provide: LEAD_QUALIFICATION_WEBSITE,
      useFactory: (
        client: SafeHttpClient,
        limits: LeadQualificationLimits,
      ): WebsiteValidator => new WebsiteValidator(client, limits),
      inject: [LEAD_QUALIFICATION_HTTP, LEAD_QUALIFICATION_LIMITS],
    },
    {
      provide: SafePageFetcher,
      useFactory: (client: SafeHttpClient): SafePageFetcher =>
        new SafePageFetcher(client),
      inject: [LEAD_QUALIFICATION_HTTP],
    },
    ExaSearchProvider,
    FirecrawlScraper,
    {
      provide: LEAD_QUALIFICATION_DISCOVERY,
      useFactory: (
        fetcher: SafePageFetcher,
        search: ExaSearchProvider,
        limits: LeadQualificationLimits,
      ): ContactDiscoveryService =>
        new ContactDiscoveryService(fetcher, search, null, limits),
      inject: [SafePageFetcher, ExaSearchProvider, LEAD_QUALIFICATION_LIMITS],
    },
    {
      provide: LEAD_QUALIFICATION_SEMANTIC,
      useFactory: (limits: LeadQualificationLimits): SemanticAssessor =>
        new LlmSemanticAssessor(llmChat, limits.llmInputChars),
      inject: [LEAD_QUALIFICATION_LIMITS],
    },
    {
      provide: LEAD_QUALIFICATION_ENGINE,
      useFactory: (
        website: WebsiteValidator,
        discovery: ContactDiscoveryService,
        semantic: SemanticAssessor,
        limits: LeadQualificationLimits,
      ): LeadQualificationEngine =>
        new LeadQualificationEngine(website, discovery, semantic, limits),
      inject: [
        LEAD_QUALIFICATION_WEBSITE,
        LEAD_QUALIFICATION_DISCOVERY,
        LEAD_QUALIFICATION_SEMANTIC,
        LEAD_QUALIFICATION_LIMITS,
      ],
    },
    {
      provide: LEAD_QUALIFICATION_STORE,
      useFactory: (prisma: PrismaService): PrismaQualificationStore =>
        new PrismaQualificationStore(prisma),
      inject: [PrismaService],
    },
    LeadQualificationService,
  ],
})
export class LeadQualificationModule {}
