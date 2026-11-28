/**
 * Browser entry point of the `research` entity.
 *
 * Client Components import this module, never `./index` — the barrel re-exports
 * server-only code (`server-only` turns that into a build error) and would pull
 * `API_URL` into the client bundle.
 */
export { fetchResearchStatus, resumeResearch } from './api/research.client';
export { fetchResearchRecipientQueue } from './api/recipient-queue.client';
export type { RecipientQueueRequest } from './api/recipient-queue.client';
export {
  attachmentLimitsSchema,
  removeResearchAttachmentResultSchema,
  researchAttachmentListSchema,
  researchAttachmentSchema,
} from './model/attachments';
export type {
  AttachmentLimits,
  RemoveResearchAttachmentResult,
  ResearchAttachment,
  ResearchAttachmentList,
  ResearchAttachmentUpload,
} from './model/attachments';
export {
  researchEmailAccountAssignmentSchema,
  researchInitialEmailSchema,
} from './model/communication';
export {
  testEmailSendResultSchema,
  type TestEmailSendResult,
} from './model/test-email';
export type {
  ResearchEmailAccountAssignment,
  ResearchInitialEmail,
} from './model/communication';
export {
  recipientQueueItemSchema,
  recipientQueuePublicationSchema,
  recipientQueueSchema,
  recipientQueueStatusSchema,
  recipientQueueTotalsSchema,
  recipientSelectionReasonSchema,
} from './model/recipient-queue';
export type {
  RecipientQueue,
  RecipientQueueItem,
  RecipientQueuePublication,
  RecipientQueueStatus,
  RecipientQueueTotals,
  RecipientSelectionReason,
} from './model/recipient-queue';
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

export { fetchStage05Contacts } from './api/stage05.client';
export {
  contactDiscoverySchema,
  stage05PayloadSchema,
  stage05ResultSchema,
  stage05RunSchema,
} from './model/stage05';
export type {
  ContactDiscoveryView,
  Stage05Address,
  Stage05Email,
  Stage05Payload,
  Stage05Phone,
  Stage05Registration,
  Stage05Result,
  Stage05Run,
} from './model/stage05';
