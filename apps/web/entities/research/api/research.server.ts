import 'server-only';

import { getJson, patchJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

import {
  researchEmailAccountAssignmentSchema,
  type ResearchEmailAccountAssignment,
} from '../model/communication';
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

/** Reads the research-specific email-account assignment. */
export function fetchResearchCommunication(
  jobId: string,
): Promise<ApiResult<ResearchEmailAccountAssignment>> {
  return getJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication`,
    researchEmailAccountAssignmentSchema,
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
