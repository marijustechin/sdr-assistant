import { BadRequestException } from '@nestjs/common';

export type RecipientQueueQuery = {
  readonly q: string;
  readonly page: number;
  readonly pageSize: number;
};

export const DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE = 25;
export const MAX_RECIPIENT_QUEUE_PAGE_SIZE = 100;
export const MAX_RECIPIENT_QUEUE_SEARCH_LENGTH = 200;

function parsePositiveInteger(
  value: string | undefined,
  name: string,
  fallback: number,
  max: number,
): number {
  if (value === undefined || value === '') return fallback;
  if (!/^[0-9]+$/.test(value)) {
    throw new BadRequestException(`${name} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(
      `${name} must be an integer between 1 and ${max}.`,
    );
  }
  return parsed;
}

/**
 * Parses the read-queue query. Page is 1-based; an out-of-range page is valid
 * and simply returns no items, so the response can never silently truncate a
 * larger result set into a shorter first page.
 */
export function parseRecipientQueueQuery(input: {
  readonly q?: string;
  readonly page?: string;
  readonly pageSize?: string;
}): RecipientQueueQuery {
  const q = (input.q ?? '').trim();

  if (q.length > MAX_RECIPIENT_QUEUE_SEARCH_LENGTH) {
    throw new BadRequestException(
      `q must be at most ${MAX_RECIPIENT_QUEUE_SEARCH_LENGTH} characters.`,
    );
  }

  return {
    q,
    page: parsePositiveInteger(input.page, 'page', 1, 1_000_000),
    pageSize: parsePositiveInteger(
      input.pageSize,
      'pageSize',
      DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
      MAX_RECIPIENT_QUEUE_PAGE_SIZE,
    ),
  };
}
