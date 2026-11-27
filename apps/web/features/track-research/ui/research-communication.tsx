'use client';

import { useEffect, useId, useRef, useState } from 'react';

import {
  fetchResearchRecipientQueue,
  type RecipientQueue,
} from '@/entities/research/client';
import { formatDateTime } from '@/shared/lib/format';

import {
  RECIPIENT_QUEUE_PAGE_SIZE,
  RECIPIENT_QUEUE_STATUS_LABELS,
  RECIPIENT_SELECTION_REASON_LABELS,
  recipientDisplayName,
  recipientQueueRange,
  type RecipientQueueData,
} from '../model/recipient-queue';

const SEARCH_DELAY_MS = 250;

type ResearchCommunicationProps = {
  readonly researchId: string;
  readonly initial: RecipientQueueData;
};

/**
 * Communication tab: the automatically prepared recipient queue.
 *
 * The first page is rendered from the server (which also ensured preparation),
 * so opening the tab performs no write. Search and page changes read later pages
 * through the same-origin route handler. The view never offers sending: a
 * prepared recipient is not eligible, authorized or sent.
 */
export function ResearchCommunication({
  researchId,
  initial,
}: ResearchCommunicationProps) {
  const id = useId();
  const [queue, setQueue] = useState<RecipientQueue | null>(
    initial.state === 'ready' ? initial.queue : null,
  );
  const [error, setError] = useState<string | null>(
    initial.state === 'error' ? initial.message : null,
  );
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  // The server already rendered the unfiltered first page. Remember which
  // request the mounted view represents so a mount (including React's
  // development StrictMode double effect) never issues a redundant read; any
  // real query, page or explicit retry change still fetches.
  const lastRequestKey = useRef(`${researchId}::1`);

  useEffect(() => {
    const requestKey = `${researchId}:${query}:${page}`;

    if (retryToken === 0 && requestKey === lastRequestKey.current) {
      return;
    }
    lastRequestKey.current = requestKey;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);

      fetchResearchRecipientQueue(
        researchId,
        { q: query, page, pageSize: RECIPIENT_QUEUE_PAGE_SIZE },
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setIsLoading(false);

          if (result.ok) {
            setQueue(result.data);
            setError(null);
          } else {
            setError(result.message);
          }
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
          setError('Could not load the recipient queue.');
        });
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [researchId, query, page, retryToken]);

  function retry(): void {
    setError(null);
    setRetryToken((value) => value + 1);
  }

  function changeQuery(next: string): void {
    setQuery(next);
    setPage(1);
  }

  if (queue === null) {
    return (
      <section className="card">
        <h2>Communication</h2>

        {error === null ? (
          <p role="status">Loading the prepared recipient queue…</p>
        ) : (
          <>
            <p className="form-error" role="alert">
              Could not prepare the recipient queue.
            </p>
            <p className="hint">{error}</p>
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={retry}
              >
                Try again
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  const range = recipientQueueRange(queue);
  const hasSearch = query.trim() !== '';
  const canGoPrevious = !isLoading && queue.page > 1;
  const canGoNext = !isLoading && queue.page < range.pageCount;

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Communication</h2>
          <p className="muted">Prepared recipient queue</p>
        </div>

        {queue.publication !== null && (
          <span className="muted">
            Stage 05 publication ·{' '}
            {formatDateTime(queue.publication.publishedAt)}
          </span>
        )}
      </div>

      <p className="hint">
        Prepared only. A discovered public email address is not permission to
        send marketing email: these recipients are not yet eligible or
        authorized, and sending is not implemented.
      </p>

      {queue.publication === null ? (
        <p className="muted" role="status">
          No published Stage 05 Contact Discovery result exists for this
          research. The queue is prepared automatically once a result is
          published.
        </p>
      ) : (
        <>
          <dl className="contact-totals">
            <div>
              <dt>Total companies</dt>
              <dd>{queue.totals.retainedCompanies}</dd>
            </div>
            <div>
              <dt>Prepared primary recipients</dt>
              <dd>{queue.totals.preparedRecipients}</dd>
            </div>
            <div>
              <dt>Alternative contacts</dt>
              <dd>{queue.totals.alternativeContacts}</dd>
            </div>
          </dl>

          {!queue.prepared && (
            <p className="hint">
              The current publication has not been prepared into the queue yet.
              Reload the research page to prepare it.
            </p>
          )}

          <div className="field filter-search stage05-search">
            <label htmlFor={`${id}-search`}>Search recipients</label>
            <input
              id={`${id}-search`}
              type="search"
              value={query}
              placeholder="Company, domain or primary email"
              onChange={(event) => changeQuery(event.currentTarget.value)}
            />
          </div>

          <div className="list-toolbar">
            <p className="muted" role="status" aria-live="polite">
              {isLoading
                ? 'Loading recipients…'
                : `Showing ${range.from}–${range.to} of ${queue.totalItems} ${
                    queue.totalItems === 1 ? 'company' : 'companies'
                  }`}
            </p>
            {hasSearch && (
              <button
                type="button"
                className="button secondary small"
                onClick={() => changeQuery('')}
              >
                Clear search
              </button>
            )}
          </div>

          {error !== null && (
            <>
              <p className="form-error" role="alert">
                {error}
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={retry}
                >
                  Try again
                </button>
              </div>
            </>
          )}

          {queue.items.length === 0 ? (
            <p className="muted">
              {hasSearch
                ? 'No recipients match this search.'
                : 'The published result has no retained companies with usable email addresses.'}
            </p>
          ) : (
            <ul className="contact-list recipient-queue-list">
              {queue.items.map((item) => (
                <li key={item.id} className="contact-row recipient-queue-row">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="contact-company">
                        {recipientDisplayName(item.companyName, item.domain)}
                      </p>
                      <a
                        className="muted"
                        href={`https://${item.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.domain}
                      </a>
                    </div>

                    <span className="status ok">
                      <span className="dot" aria-hidden="true" />
                      {RECIPIENT_QUEUE_STATUS_LABELS[item.status]}
                    </span>
                  </div>

                  <div>
                    <p className="company-subtitle">Primary email</p>
                    <p>{item.primaryEmail}</p>
                    <p className="hint">
                      {RECIPIENT_SELECTION_REASON_LABELS[item.selectionReason]}
                    </p>
                  </div>

                  <details className="stage05-details">
                    <summary>
                      {item.alternativeEmails.length}{' '}
                      {item.alternativeEmails.length === 1
                        ? 'alternative contact'
                        : 'alternative contacts'}
                    </summary>

                    {item.alternativeEmails.length === 0 ? (
                      <p className="hint">
                        No alternative email addresses recorded.
                      </p>
                    ) : (
                      <ul className="contact-values">
                        {item.alternativeEmails.map((email) => (
                          <li key={email} className="contact-value">
                            {email}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}

          {range.pageCount > 1 && (
            <nav className="pagination" aria-label="Recipient pages">
              <button
                type="button"
                className="button secondary small"
                disabled={!canGoPrevious}
                onClick={() => setPage(queue.page - 1)}
              >
                Previous page
              </button>
              <span className="muted">
                Page {queue.page} of {range.pageCount}
              </span>
              <button
                type="button"
                className="button secondary small"
                disabled={!canGoNext}
                onClick={() => setPage(queue.page + 1)}
              >
                Next page
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
