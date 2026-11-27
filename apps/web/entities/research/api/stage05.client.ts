import { getJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';

import { stage05PayloadSchema, type Stage05Payload } from '../model/stage05';

export function fetchStage05Contacts(
  researchId: string,
  signal?: AbortSignal,
): Promise<ApiResult<Stage05Payload>> {
  return getJson(
    `/api/research/${encodeURIComponent(researchId)}/stage05`,
    stage05PayloadSchema,
    { signal },
  );
}
