import { z } from 'zod';

import { getJson, requestJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';

import { researchResponseSchema, type ResearchResponse } from '../model/schema';

const resumeResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal('RUNNING'),
});

/**
 * Browser-side status read through the same-origin proxy.
 *
 * An abort initiated by the caller is re-thrown (see `shared/api/http.ts`), so
 * the polling hook can tell an unmount apart from a real failure.
 */
export function fetchResearchStatus(
  jobId: string,
  signal?: AbortSignal,
): Promise<ApiResult<ResearchResponse>> {
  return getJson(
    `/api/research/${encodeURIComponent(jobId)}`,
    researchResponseSchema,
    { signal },
  );
}

export function resumeResearch(
  jobId: string,
): Promise<ApiResult<z.infer<typeof resumeResponseSchema>>> {
  return requestJson(
    `/api/research/${encodeURIComponent(jobId)}/resume`,
    resumeResponseSchema,
    { method: 'POST' },
  );
}
