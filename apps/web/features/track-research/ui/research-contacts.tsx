'use client';

import { useId, useMemo, useState } from 'react';

import type {
  Stage05Address,
  Stage05Email,
  Stage05Phone,
  Stage05Registration,
} from '@/entities/research/client';

import {
  buildStage05Rows,
  filterStage05Rows,
  stage05Page,
  stage05ReasonLabel,
  stage05SourceUrls,
  stage05Totals,
  type Stage05CompanyRow,
} from '../model/stage05-browser';
import type { Stage05ContactsState } from '../model/use-stage05-contacts';
import { SourceLink } from './source-link';

const PAGE_SIZE = 20;

function sourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function EmailList({ emails }: { emails: readonly Stage05Email[] }) {
  if (emails.length === 0) {
    return <p className="hint">No usable email recorded.</p>;
  }

  return (
    <ul className="contact-values">
      {emails.map((email) => (
        <li key={email.value} className="contact-value">
          <span>{email.value}</span>
          {email.employeeName !== null && email.employeeName !== undefined && (
            <span className="hint">
              {' '}
              · {email.employeeName}
              {email.employeePosition ? `, ${email.employeePosition}` : ''}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PartnerContacts({ emails }: { emails: readonly Stage05Email[] }) {
  if (emails.length === 0) return null;

  return (
    <div className="partner-contacts">
      <p className="company-subtitle">Partner / distributor contacts</p>
      <p className="hint">
        These are not company communication-ready addresses.
      </p>
      <EmailList emails={emails} />
    </div>
  );
}

function PhoneList({ phones }: { phones: readonly Stage05Phone[] }) {
  if (phones.length === 0) {
    return <p className="hint">No telephone number recorded.</p>;
  }

  return (
    <ul className="contact-values">
      {phones.map((phone) => (
        <li key={phone.normalized} className="contact-value">
          <span>{phone.originalValues[0] ?? phone.normalized}</span>
          {phone.originalValues[0] !== undefined &&
            phone.originalValues[0] !== phone.normalized && (
              <span className="hint"> · {phone.normalized}</span>
            )}
          {phone.countries.length > 0 && (
            <span className="hint"> · {phone.countries.join(', ')}</span>
          )}
          {phone.local === true && <span className="hint"> · local</span>}
          {phone.reliableForeign === true && (
            <span className="hint"> · foreign</span>
          )}
          {phone.ambiguous === true && (
            <span className="hint"> · country ambiguous</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function AddressList({ addresses }: { addresses: readonly Stage05Address[] }) {
  if (addresses.length === 0) {
    return <p className="hint">No business address recorded.</p>;
  }

  return (
    <ul className="contact-values">
      {addresses.map((address) => (
        <li key={address.value} className="contact-value">
          <span>{address.value}</span>
          {address.structured?.addressCountry !== undefined && (
            <span className="hint"> · {address.structured.addressCountry}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RegistrationList({
  registrations,
}: {
  registrations: readonly Stage05Registration[];
}) {
  if (registrations.length === 0) {
    return <p className="hint">No registration identifier recorded.</p>;
  }

  return (
    <ul className="contact-values">
      {registrations.map((registration) => (
        <li
          key={`${registration.kind}-${registration.value}`}
          className="contact-value"
        >
          <span>{registration.value}</span>
          <span className="hint"> · {registration.kind}</span>
        </li>
      ))}
    </ul>
  );
}

function CompanyDetails({ row }: { row: Stage05CompanyRow }) {
  const sources = [
    ...new Map(
      stage05SourceUrls(row).map((url) => [sourceLabel(url), url]),
    ).values(),
  ];

  return (
    <details className="stage05-details">
      <summary>Phones, addresses, identifiers and sources</summary>
      <div className="stage05-detail-grid">
        <div>
          <p className="company-subtitle">Telephone numbers</p>
          <PhoneList phones={row.contact?.phones ?? []} />
        </div>
        <div>
          <p className="company-subtitle">Business addresses</p>
          <AddressList addresses={row.contact?.addresses ?? []} />
        </div>
        <div>
          <p className="company-subtitle">Registration identifiers</p>
          <RegistrationList
            registrations={row.contact?.registrationIdentifiers ?? []}
          />
        </div>
      </div>

      <div>
        <p className="company-subtitle">Contact source links</p>
        {sources.length === 0 ? (
          <p className="hint">No source link recorded.</p>
        ) : (
          <ul className="source-list">
            {sources.map((url) => (
              <li key={url}>
                <SourceLink url={url} label={sourceLabel(url)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <PartnerContacts emails={row.partnerEmails} />
    </details>
  );
}

type CompletedState = Extract<Stage05ContactsState, { phase: 'completed' }>;

function CompletedContacts({ state }: { state: CompletedState }) {
  const id = useId();
  const [view, setView] = useState<'retained' | 'excluded'>('retained');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const totals = useMemo(
    () => stage05Totals(state.retained, state.excluded),
    [state.retained, state.excluded],
  );
  const rows = useMemo(
    () =>
      buildStage05Rows(view === 'retained' ? state.retained : state.excluded),
    [view, state.retained, state.excluded],
  );
  const filtered = useMemo(() => filterStage05Rows(rows, query), [rows, query]);
  const pageData = stage05Page(filtered, page, PAGE_SIZE);

  function changeView(next: 'retained' | 'excluded'): void {
    setView(next);
    setPage(1);
  }

  return (
    <section className="card" aria-labelledby={`${id}-heading`}>
      <div className="card-header">
        <div>
          <h2 id={`${id}-heading`}>Contacts</h2>
          <p className="muted stage05-run-line">
            Stage 05 Contact Discovery ·{' '}
            <span className="stage05-status">{state.run.status}</span>
          </p>
        </div>
        <span className="muted">Published contact discovery</span>
      </div>

      <dl className="contact-totals">
        <div>
          <dt>Retained companies</dt>
          <dd>{totals.retained}</dd>
        </div>
        <div>
          <dt>Usable email addresses</dt>
          <dd>{totals.usableEmails}</dd>
        </div>
        <div>
          <dt>Excluded companies</dt>
          <dd>{totals.excluded}</dd>
        </div>
      </dl>

      <div className="segmented-control" role="group" aria-label="Company view">
        <button
          type="button"
          className={`button small ${view === 'retained' ? '' : 'secondary'}`}
          aria-pressed={view === 'retained'}
          onClick={() => changeView('retained')}
        >
          Retained companies ({totals.retained})
        </button>
        <button
          type="button"
          className={`button small ${view === 'excluded' ? '' : 'secondary'}`}
          aria-pressed={view === 'excluded'}
          onClick={() => changeView('excluded')}
        >
          Excluded companies ({totals.excluded})
        </button>
      </div>

      <div className="field filter-search stage05-search">
        <label htmlFor={`${id}-search`}>Search contacts</label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          placeholder="Company, domain or email"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="list-toolbar">
        <p className="muted" role="status" aria-live="polite">
          Showing {pageData.from}–{pageData.to} of {pageData.total}{' '}
          {view === 'retained' ? 'retained companies' : 'excluded companies'}
        </p>
        {query.trim() !== '' && (
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              setQuery('');
              setPage(1);
            }}
          >
            Clear search
          </button>
        )}
      </div>

      {pageData.items.length === 0 ? (
        <p className="muted">
          {rows.length === 0
            ? view === 'retained'
              ? 'No retained companies are present in the published result.'
              : 'No excluded companies are present in the published result.'
            : 'No companies match this search.'}
        </p>
      ) : view === 'retained' ? (
        <ul className="contact-list stage05-company-list">
          {pageData.items.map((row) => (
            <li key={row.result.id} className="contact-row stage05-company">
              <div className="stage05-company-heading">
                <div>
                  <p className="contact-company">{row.displayName}</p>
                  <a
                    className="muted"
                    href={`https://${row.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.domain}
                  </a>
                </div>
                <span className="hint">
                  {row.usableEmails.length}{' '}
                  {row.usableEmails.length === 1 ? 'email' : 'emails'}
                </span>
              </div>

              <div>
                <p className="company-subtitle">Usable email addresses</p>
                <EmailList emails={row.usableEmails} />
              </div>

              <CompanyDetails row={row} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="contact-list stage05-excluded-list">
          {pageData.items.map((row) => (
            <li key={row.result.id} className="contact-row">
              <div>
                <p className="contact-company">{row.displayName}</p>
                <p className="muted">{row.domain}</p>
              </div>
              <p>
                <span className="company-subtitle">Exclusion reason</span>{' '}
                {stage05ReasonLabel(row.result.primaryExclusionReason)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {pageData.pageCount > 1 && (
        <nav className="pagination" aria-label="Contact pages">
          <button
            type="button"
            className="button secondary small"
            disabled={pageData.page === 1}
            onClick={() => setPage(pageData.page - 1)}
          >
            Previous page
          </button>
          <span className="muted">
            Page {pageData.page} of {pageData.pageCount}
          </span>
          <button
            type="button"
            className="button secondary small"
            disabled={pageData.page === pageData.pageCount}
            onClick={() => setPage(pageData.page + 1)}
          >
            Next page
          </button>
        </nav>
      )}
    </section>
  );
}

export function ResearchContacts({
  state,
  onRetry,
}: {
  state: Stage05ContactsState;
  onRetry: () => void;
}) {
  if (state.phase === 'loading') {
    return (
      <section className="card">
        <h2>Contacts</h2>
        <p role="status">Loading Stage 05 contact discovery…</p>
      </section>
    );
  }

  if (state.phase === 'none') {
    return (
      <section className="card">
        <h2>Contacts</h2>
        <p className="muted" role="status">
          No Stage 05 contact discovery result exists for this research.
        </p>
      </section>
    );
  }

  if (state.phase === 'error') {
    return (
      <section className="card">
        <h2>Contacts</h2>
        <p className="form-error" role="alert">
          {state.message}
        </p>
        <button type="button" className="button secondary" onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  if (state.phase === 'running') {
    return (
      <section className="card">
        <h2>Contacts</h2>
        <p role="status">
          Stage 05 Contact Discovery is {state.run.status.toLowerCase()}…
        </p>
      </section>
    );
  }

  if (state.phase === 'failed') {
    return (
      <section className="card">
        <h2>Contacts</h2>
        <p className="form-error" role="alert">
          Stage 05 Contact Discovery failed: {state.message}
        </p>
        <button type="button" className="button secondary" onClick={onRetry}>
          Check again
        </button>
      </section>
    );
  }

  return <CompletedContacts state={state} />;
}
