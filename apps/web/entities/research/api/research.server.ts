import 'server-only';

import { getJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

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
