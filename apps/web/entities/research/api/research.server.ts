import 'server-only';

import { getJson, patchJson, postJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

import {
  researchCommunicationSchema,
  researchEmailAccountAssignmentSchema,
  researchInitialEmailSchema,
  type ResearchCommunication,
  type ResearchEmailAccountAssignment,
  type ResearchInitialEmail,
} from '../model/communication';
import {
  recipientQueueSchema,
  type RecipientQueue,
} from '../model/recipient-queue';
import {
  researchListSchema,
  researchResponseSchema,
  type ResearchResponse,
} from '../model/schema';

export function fetchResearch(
  jobId: string,
): Promise<ApiResult<ResearchResponse>> {
  return getJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}`,
    researchResponseSchema,
  );
}

export function fetchResearches(): Promise<ApiResult<ResearchResponse[]>> {
  return getJson(`${apiUrl}/research`, researchListSchema);
}

/** Reads the research-specific communication settings. */
export function fetchResearchCommunication(
  jobId: string,
): Promise<ApiResult<ResearchCommunication>> {
  return getJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication`,
    researchCommunicationSchema,
  );
}

/**
 * Assigns, changes or removes the research email account. `null` removes the
 * assignment; credentials never pass through this request.
 */
export function updateResearchEmailAccount(
  jobId: string,
  emailAccountId: string | null,
): Promise<ApiResult<ResearchEmailAccountAssignment>> {
  return patchJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/email-account`,
    { emailAccountId },
    researchEmailAccountAssignmentSchema,
  );
}

/** Saves the owner-authored plain-text initial email (subject and message). */
export function updateResearchInitialEmail(
  jobId: string,
  subject: string,
  body: string,
): Promise<ApiResult<ResearchInitialEmail>> {
  return patchJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/initial-email`,
    { subject, body },
    researchInitialEmailSchema,
  );
}

/**
 * Ensures the prepared recipient queue matches the current published Stage 05
 * result and returns its first page. The operation is idempotent.
 */
export function prepareResearchRecipientQueue(
  jobId: string,
): Promise<ApiResult<RecipientQueue>> {
  return postJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/recipient-queue/prepare`,
    undefined,
    recipientQueueSchema,
  );
}
