'use client';

import { useId, useMemo, useState } from 'react';

import type {
  CompanyEmail,
  CompanyPhone,
  ResearchResultView,
} from '@/entities/research/client';

import {
  buildCompanyContactRows,
  contactTotals,
  filterContactRows,
  type ContactTypeFilter,
} from '../model/contact-browser';
import { paginate } from '../model/company-browser';
import { resultAvailabilityMessage } from '../model/presentation';
import { SourceLink } from './source-link';

const PAGE_SIZE = 20;

function toContactType(value: string): ContactTypeFilter {
  switch (value) {
    case 'email':
    case 'phone':
      return value;
    default:
      return 'all';
  }
}

function EmailValue({ email }: { email: CompanyEmail }) {
  return (
    <li className="contact-value">
      <span>{email.value}</span>
      {email.label !== null && <span className="hint"> · {email.label}</span>}
      {email.sourceUrl !== null && (
        <span>
          {' '}
          · <SourceLink url={email.sourceUrl} />
        </span>
      )}
    </li>
  );
}

function PhoneValue({ phone }: { phone: CompanyPhone }) {
  return (
    <li className="contact-value">
      <span>{phone.value}</span>
      {phone.label !== null && <span className="hint"> · {phone.label}</span>}
      {phone.sourceUrl !== null && (
        <span>
          {' '}
          · <SourceLink url={phone.sourceUrl} />
        </span>
      )}
    </li>
  );
}

export function ResearchContacts({ result }: { result: ResearchResultView }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ContactTypeFilter>('all');
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () => buildCompanyContactRows(result.companies),
    [result.companies],
  );
  const totals = useMemo(
    () => contactTotals(result.companies),
    [result.companies],
  );
  const filtered = useMemo(
    () => filterContactRows(rows, query, type),
    [rows, query, type],
  );
  const pageData = paginate(filtered, page, PAGE_SIZE);

  if (result.state !== 'profiles') {
    return (
      <section className="card">
        <h2>Contacts</h2>
        <p>{resultAvailabilityMessage(result)}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Contacts</h2>
        <span className="muted">{rows.length} companies with contacts</span>
      </div>

      <p className="hint">
        Discovered contact details are shown as published. They are not verified
        for deliverability, and the research pipeline does not record contact
        persons.
      </p>

      <dl className="contact-totals">
        <div>
          <dt>Email address values</dt>
          <dd>{totals.emailValues}</dd>
        </div>
        <div>
          <dt>Unique email addresses</dt>
          <dd>{totals.uniqueEmails}</dd>
        </div>
        <div>
          <dt>Telephone number values</dt>
          <dd>{totals.phoneValues}</dd>
        </div>
        <div>
          <dt>Unique telephone numbers</dt>
          <dd>{totals.uniquePhones}</dd>
        </div>
      </dl>

      {rows.length === 0 ? (
        <p className="muted" role="status">
          No contact information was discovered for this research.
        </p>
      ) : (
        <>
          <div className="filter-row">
            <div className="field filter-search">
              <label htmlFor={`${id}-search`}>Search contacts</label>
              <input
                id={`${id}-search`}
                type="search"
                value={query}
                placeholder="Company, domain, email or phone"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="field">
              <label htmlFor={`${id}-type`}>Contact type</label>
              <select
                id={`${id}-type`}
                value={type}
                onChange={(event) => {
                  setType(toContactType(event.target.value));
                  setPage(1);
                }}
              >
                <option value="all">All contact types</option>
                <option value="email">Email addresses</option>
                <option value="phone">Telephone numbers</option>
              </select>
            </div>
          </div>

          <div className="list-toolbar">
            <p className="muted" role="status" aria-live="polite">
              Showing {pageData.from}–{pageData.to} of {pageData.total}{' '}
              companies with contacts
            </p>
            {(query.trim() !== '' || type !== 'all') && (
              <button
                type="button"
                className="button secondary small"
                onClick={() => {
                  setQuery('');
                  setType('all');
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {pageData.items.length === 0 ? (
            <p className="muted">No contacts match these filters.</p>
          ) : (
            <>
              <ul className="contact-list">
                {pageData.items.map((row) => (
                  <li key={row.company.key} className="contact-row">
                    <div>
                      <p className="contact-company">{row.displayName}</p>
                      <p className="muted">{row.company.domain}</p>
                    </div>

                    {type !== 'phone' && (
                      <div>
                        <p className="company-subtitle">Email addresses</p>
                        {row.emails.length === 0 ? (
                          <p className="hint">No email address recorded.</p>
                        ) : (
                          <ul className="contact-values">
                            {row.emails.map((email, index) => (
                              <EmailValue
                                key={`${index}-${email.value}`}
                                email={email}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {type !== 'email' && (
                      <div>
                        <p className="company-subtitle">Telephone numbers</p>
                        {row.phones.length === 0 ? (
                          <p className="hint">No telephone number recorded.</p>
                        ) : (
                          <ul className="contact-values">
                            {row.phones.map((phone, index) => (
                              <PhoneValue
                                key={`${index}-${phone.value}`}
                                phone={phone}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

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
            </>
          )}
        </>
      )}
    </section>
  );
}
