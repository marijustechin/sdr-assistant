/**
 * Browser entry point of the `research` entity.
 *
 * Client Components import this module, never `./index` — the barrel re-exports
 * server-only code (`server-only` turns that into a build error) and would pull
 * `API_URL` into the client bundle.
 */
export { fetchResearchStatus, resumeResearch } from './api/research.client';
export {
  PROFILING_SUMMARY_KEYS,
  RESULT_AVAILABILITY_LABELS,
  parseResearchResult,
  researchResultAvailabilitySchema,
  researchResultDetailSchema,
  toResearchListItem,
} from './model/result';
export type {
  CompanyEmail,
  CompanyOfferView,
  CompanyPhone,
  CompanyPrice,
  CompanyProfileStatus,
  CompanyProfileView,
  MarketEvidenceView,
  MarketFrom03View,
  MarketView,
  ProfilingSummary,
  ProfilingSummaryKey,
  ResearchListItem,
  ResearchResultAvailability,
  ResearchResultDetail,
  ResearchResultView,
} from './model/result';
export type { ResearchResponse, ResearchStatus } from './model/schema';
