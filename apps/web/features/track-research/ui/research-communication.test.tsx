// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchResearchRecipientQueue } = vi.hoisted(() => ({
  fetchResearchRecipientQueue: vi.fn(),
}));

vi.mock('@/entities/research/client', () => ({
  fetchResearchRecipientQueue,
}));

import type {
  RecipientQueue,
  RecipientQueueItem,
} from '@/entities/research/client';

import type { RecipientQueueData } from '../model/recipient-queue';
import { ResearchCommunication } from './research-communication';

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
      retainedCompanies: 71,
      preparedRecipients: 2,
      alternativeContacts: 1,
    },
    items: [
      item(),
      item({
        id: 'recipient-2',
        companyName: 'Beta',
        domain: 'beta.test',
        primaryEmail: 'hello@beta.test',
        alternativeEmails: [],
        selectionReason: 'GENERAL_MAILBOX',
      }),
    ],
    page: 1,
    pageSize: 25,
    totalItems: 2,
    ...overrides,
  };
}

function readyQueue(
  overrides: Partial<RecipientQueue> = {},
): RecipientQueueData {
  return { state: 'ready', queue: queue(overrides) };
}

function renderCommunication(initial: RecipientQueueData): void {
  render(<ResearchCommunication researchId="research-1" initial={initial} />);
}

function metricValues(): string[] {
  return Array.from(document.querySelectorAll('.contact-totals dd')).map(
    (element) => element.textContent ?? '',
  );
}

afterEach(() => {
  cleanup();
  fetchResearchRecipientQueue.mockReset();
});

describe('ResearchCommunication', () => {
  it('renders the prepared queue from the server page without a write or read', () => {
    renderCommunication(readyQueue());

    expect(fetchResearchRecipientQueue).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Communication' }),
    ).toBeTruthy();
    expect(metricValues()).toEqual(['71', '2', '1']);
    expect(screen.getByText('Alpha Sauna OÜ')).toBeTruthy();
    expect(screen.getByText('alpha-sauna.test')).toBeTruthy();
    expect(screen.getByText('sales@alpha-sauna.test')).toBeTruthy();
    expect(screen.getAllByText('Prepared', { exact: true })).toHaveLength(2);
    expect(screen.getByText('Sales / commercial mailbox')).toBeTruthy();
    expect(screen.getByText('1 alternative contact')).toBeTruthy();
    expect(screen.getByText('info@alpha-sauna.test')).toBeTruthy();
    expect(screen.getByText(/not yet eligible or authorized/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('searches through the same-origin read and updates the visible page', async () => {
    fetchResearchRecipientQueue.mockResolvedValue({
      ok: true,
      data: queue({
        items: [
          item({
            id: 'recipient-beta',
            companyName: 'Beta Wood',
            domain: 'beta.test',
            primaryEmail: 'hello@beta.test',
            alternativeEmails: [],
            selectionReason: 'GENERAL_MAILBOX',
          }),
        ],
        totalItems: 1,
      }),
    });
    renderCommunication(readyQueue());

    fireEvent.change(screen.getByLabelText('Search recipients'), {
      target: { value: 'beta' },
    });

    await waitFor(() =>
      expect(fetchResearchRecipientQueue).toHaveBeenCalledWith(
        'research-1',
        { q: 'beta', page: 1, pageSize: 25 },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.getByText('Beta Wood')).toBeTruthy());
    expect(screen.getByText('Showing 1–1 of 1 company')).toBeTruthy();
    expect(screen.queryByText('Alpha Sauna OÜ')).toBeNull();
  });

  it('paginates from server totals and never truncates silently', async () => {
    const firstPageItems = Array.from({ length: 25 }, (_value, index) =>
      item({
        id: `recipient-${index}`,
        companyName: `Company ${index}`,
        domain: `company-${index}.test`,
        primaryEmail: `info@company-${index}.test`,
        alternativeEmails: [],
        selectionReason: 'GENERAL_MAILBOX',
      }),
    );

    renderCommunication(
      readyQueue({
        items: firstPageItems,
        totals: {
          retainedCompanies: 30,
          preparedRecipients: 30,
          alternativeContacts: 0,
        },
        totalItems: 30,
        page: 1,
        pageSize: 25,
      }),
    );

    expect(screen.getByText('Showing 1–25 of 30 companies')).toBeTruthy();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty(
      'disabled',
      false,
    );

    const lastPageItems = Array.from({ length: 5 }, (_value, index) =>
      item({
        id: `recipient-last-${index}`,
        companyName: `Company ${25 + index}`,
        domain: `company-${25 + index}.test`,
        primaryEmail: `info@company-${25 + index}.test`,
        alternativeEmails: [],
        selectionReason: 'GENERAL_MAILBOX',
      }),
    );

    fetchResearchRecipientQueue.mockResolvedValue({
      ok: true,
      data: queue({
        items: lastPageItems,
        totals: {
          retainedCompanies: 30,
          preparedRecipients: 30,
          alternativeContacts: 0,
        },
        totalItems: 30,
        page: 2,
        pageSize: 25,
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(fetchResearchRecipientQueue).toHaveBeenCalledWith(
        'research-1',
        { q: '', page: 2, pageSize: 25 },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText('Showing 26–30 of 30 companies')).toBeTruthy(),
    );
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the missing-publication state', () => {
    renderCommunication(
      readyQueue({
        publication: null,
        prepared: false,
        totals: {
          retainedCompanies: 0,
          preparedRecipients: 0,
          alternativeContacts: 0,
        },
        items: [],
        totalItems: 0,
      }),
    );

    expect(
      screen.getByText(/No published Stage 05 Contact Discovery result/),
    ).toBeTruthy();
    expect(screen.queryByText('Total companies')).toBeNull();
  });

  it('shows the empty prepared-queue state', () => {
    renderCommunication(
      readyQueue({
        totals: {
          retainedCompanies: 0,
          preparedRecipients: 0,
          alternativeContacts: 0,
        },
        items: [],
        totalItems: 0,
      }),
    );

    expect(metricValues()).toEqual(['0', '0', '0']);
    expect(
      screen.getByText(
        'The published result has no retained companies with usable email addresses.',
      ),
    ).toBeTruthy();
  });

  it('shows an empty search result without changing the global totals', async () => {
    fetchResearchRecipientQueue.mockResolvedValue({
      ok: true,
      data: queue({
        items: [],
        totalItems: 0,
        totals: {
          retainedCompanies: 71,
          preparedRecipients: 71,
          alternativeContacts: 63,
        },
      }),
    });
    renderCommunication(readyQueue());

    fireEvent.change(screen.getByLabelText('Search recipients'), {
      target: { value: 'nothing' },
    });

    await waitFor(() =>
      expect(screen.getByText('No recipients match this search.')).toBeTruthy(),
    );
    expect(metricValues()).toEqual(['71', '71', '63']);
  });

  it('shows the no-alternative state', () => {
    renderCommunication(readyQueue());

    expect(screen.getByText('0 alternative contacts')).toBeTruthy();
    expect(
      screen.getByText('No alternative email addresses recorded.'),
    ).toBeTruthy();
  });

  it('renders an initial load error and retries through the read endpoint', async () => {
    fetchResearchRecipientQueue.mockResolvedValue({
      ok: true,
      data: queue(),
    });
    renderCommunication({ state: 'error', message: 'The API is unavailable.' });

    expect(screen.getByText('The API is unavailable.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(fetchResearchRecipientQueue).toHaveBeenCalledWith(
        'research-1',
        { q: '', page: 1, pageSize: 25 },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText('Alpha Sauna OÜ')).toBeTruthy(),
    );
  });

  it('keeps the loaded page and offers a retry when a read fails', async () => {
    fetchResearchRecipientQueue.mockResolvedValue({
      ok: false,
      status: 500,
      reason: 'http',
      message: 'The API is unavailable.',
    });
    renderCommunication(readyQueue());

    fireEvent.change(screen.getByLabelText('Search recipients'), {
      target: { value: 'beta' },
    });

    await waitFor(() =>
      expect(screen.getByText('The API is unavailable.')).toBeTruthy(),
    );
    expect(screen.getByText('Alpha Sauna OÜ')).toBeTruthy();

    fetchResearchRecipientQueue.mockResolvedValue({
      ok: true,
      data: queue({ items: [], totalItems: 0 }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(fetchResearchRecipientQueue).toHaveBeenCalledTimes(2),
    );
  });
});
