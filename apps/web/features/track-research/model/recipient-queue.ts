import type {
  RecipientQueue,
  RecipientQueueStatus,
  RecipientSelectionReason,
} from '@/entities/research/client';

/** One page of the prepared recipient queue, read on the server. */
export type RecipientQueueData =
  | { readonly state: 'ready'; readonly queue: RecipientQueue }
  | { readonly state: 'error'; readonly message: string };

/** Page size shared by the server-rendered first page and browser reads. */
export const RECIPIENT_QUEUE_PAGE_SIZE = 25;

export const RECIPIENT_SELECTION_REASON_LABELS: Record<
  RecipientSelectionReason,
  string
> = {
  SALES_DEPARTMENT: 'Sales / commercial mailbox',
  GENERAL_MAILBOX: 'General company mailbox',
  INDIVIDUAL_CONTACT: 'Individual company contact',
};

export const RECIPIENT_QUEUE_STATUS_LABELS: Record<
  RecipientQueueStatus,
  string
> = {
  PREPARED: 'Prepared',
};

export function recipientDisplayName(
  companyName: string | null,
  domain: string,
): string {
  return companyName ?? domain;
}

export type RecipientQueueRange = {
  readonly from: number;
  readonly to: number;
  readonly pageCount: number;
};

/**
 * Computes the visible range and page count from the server totals. Never
 * derives the total from the page length, so a page can never silently shorten
 * a larger result set.
 */
export function recipientQueueRange(
  queue: RecipientQueue,
): RecipientQueueRange {
  const pageCount =
    queue.totalItems === 0 ? 0 : Math.ceil(queue.totalItems / queue.pageSize);

  if (queue.items.length === 0) {
    return { from: 0, to: 0, pageCount };
  }

  const from = (queue.page - 1) * queue.pageSize + 1;
  const to = Math.min(queue.totalItems, from + queue.items.length - 1);

  return { from, to, pageCount };
}
