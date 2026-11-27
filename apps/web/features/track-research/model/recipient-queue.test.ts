import { describe, expect, it } from 'vitest';

import type {
  RecipientQueue,
  RecipientQueueItem,
} from '@/entities/research/client';

import {
  RECIPIENT_QUEUE_STATUS_LABELS,
  RECIPIENT_SELECTION_REASON_LABELS,
  recipientDisplayName,
  recipientQueueRange,
} from './recipient-queue';

function item(overrides: Partial<RecipientQueueItem> = {}): RecipientQueueItem {
  return {
    id: 'recipient-1',
    companyName: 'Alpha Sauna OÜ',
    domain: 'alpha-sauna.test',
    primaryEmail: 'sales@alpha-sauna.test',
    alternativeEmails: ['info@alpha-sauna.test'],
    selectionReason: 'SALES_DEPARTMENT',
    status: 'PREPARED',
    createdAt: '2026-11-27T10:00:00.000Z',
    updatedAt: '2026-11-27T10:00:00.000Z',
    ...overrides,
  };
}

function queue(overrides: Partial<RecipientQueue> = {}): RecipientQueue {
  return {
    publication: {
      runId: 'run-1',
      publishedAt: '2026-11-27T10:00:00.000Z',
    },
    prepared: true,
    totals: {
      retainedCompanies: 3,
      preparedRecipients: 2,
      alternativeContacts: 1,
    },
    items: [item()],
    page: 1,
    pageSize: 25,
    totalItems: 2,
    ...overrides,
  };
}

describe('recipient queue model', () => {
  it('labels every selection reason and queue status', () => {
    expect(RECIPIENT_SELECTION_REASON_LABELS).toEqual({
      SALES_DEPARTMENT: 'Sales / commercial mailbox',
      GENERAL_MAILBOX: 'General company mailbox',
      INDIVIDUAL_CONTACT: 'Individual company contact',
    });
    expect(RECIPIENT_QUEUE_STATUS_LABELS).toEqual({ PREPARED: 'Prepared' });
  });

  it('falls back to the domain when no company name is known', () => {
    expect(recipientDisplayName('Alpha', 'alpha.test')).toBe('Alpha');
    expect(recipientDisplayName(null, 'alpha.test')).toBe('alpha.test');
  });

  it('computes the visible range from server totals, not the page length', () => {
    expect(
      recipientQueueRange(
        queue({
          items: Array.from({ length: 25 }, (_value, index) =>
            item({ id: `recipient-${index}` }),
          ),
          page: 2,
          totalItems: 2_000,
        }),
      ),
    ).toEqual({ from: 26, to: 50, pageCount: 80 });
  });

  it('handles an empty page and an empty result', () => {
    expect(
      recipientQueueRange(queue({ items: [], page: 3, totalItems: 50 })),
    ).toEqual({ from: 0, to: 0, pageCount: 2 });
    expect(
      recipientQueueRange(
        queue({
          items: [],
          page: 1,
          totalItems: 0,
          totals: {
            retainedCompanies: 0,
            preparedRecipients: 0,
            alternativeContacts: 0,
          },
        }),
      ),
    ).toEqual({ from: 0, to: 0, pageCount: 0 });
  });

  it('never reports more visible rows than the filtered total', () => {
    expect(
      recipientQueueRange(queue({ items: [item(), item()], totalItems: 2 })),
    ).toEqual({ from: 1, to: 2, pageCount: 1 });
  });
});
