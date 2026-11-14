import { getJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';

import { researchResponseSchema, type ResearchResponse } from '../model/schema';

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
