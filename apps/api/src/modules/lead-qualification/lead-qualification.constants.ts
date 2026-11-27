import type { LeadQualificationLimits } from './lead-qualification.types.js';

export const LEAD_QUALIFICATION_SCHEMA_VERSION = 1;
export const LEAD_QUALIFICATION_VERSION = 'lead-qualification-v1';
export const LEAD_QUALIFICATION_POLICY_VERSION = 'lead-qualification-policy-v1';
export const LEAD_QUALIFICATION_PROMPT_VERSION = 'lead-qualification-semantic-v2';
export const LEAD_QUALIFICATION_SEMANTIC_MODEL = 'deepseek-flash';

export const DEFAULT_LEAD_QUALIFICATION_LIMITS: LeadQualificationLimits = {
  maxCompaniesPerRun: 5_000,
  maxSourceBytes: 50 * 1024 * 1024,
  websiteAttempts: 2,
  websiteTimeoutMs: 10_000,
  websiteMaxRedirects: 5,
  websiteMaxBodyBytes: 256 * 1024,
  websiteConcurrency: 8,
  discoveryPages: 3,
  discoverySearchQueries: 2,
  discoverySearchResults: 5,
  discoveryFetchedSearchResults: 2,
  discoveryFirecrawlPages: 1,
  searchConcurrency: 4,
  llmCallsPerCompany: 1,
  llmCallsPerRun: 400,
  llmInputChars: 16_000,
  llmOutputTokens: 2_000,
  llmConcurrency: 3,
  runDurationMs: 120 * 60 * 1000,
  leaseMs: 2 * 60 * 1000,
  heartbeatMs: 30 * 1000,
  maxEvidencePerResult: 20,
  maxQuoteChars: 500,
  maxResultJsonBytes: 100 * 1024,
};

export const RUN_STATUSES = [
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'INTERRUPTED',
  'FAILED',
] as const;

export const EXCLUSION_REASONS = [
  'WEBSITE_UNAVAILABLE',
  'NO_VALID_HTTPS',
  'INACTIVE_BUSINESS',
  'COUNTRY_MISMATCH',
  'COUNTRY_UNCONFIRMED',
  'IRRELEVANT_BUSINESS',
  'EMAIL_NOT_FOUND',
  'DUPLICATE_COMPANY',
  'INSUFFICIENT_EVIDENCE',
  'PROCESSING_FAILED',
] as const;
