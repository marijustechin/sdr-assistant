import { getJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';

import {
  recipientQueueSchema,
  type RecipientQueue,
} from '../model/recipient-queue';

export type RecipientQueueRequest = {
  readonly q: string;
  readonly page: number;
  readonly pageSize: number;
};

/**
 * Reads one page of the persisted recipient queue through the same-origin route
 * handler. The API has no CORS, so browser code never calls it directly.
 */
export function fetchResearchRecipientQueue(
  researchId: string,
  request: RecipientQueueRequest,
  signal?: AbortSignal,
): Promise<ApiResult<RecipientQueue>> {
  const params = new URLSearchParams({
    page: String(request.page),
    pageSize: String(request.pageSize),
  });

  if (request.q !== '') params.set('q', request.q);

  return getJson(
    `/api/research/${encodeURIComponent(researchId)}/recipient-queue?${params.toString()}`,
    recipientQueueSchema,
    { signal },
  );
}
