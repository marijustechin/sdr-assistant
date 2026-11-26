'use client';

import { useId, useMemo, useState } from 'react';

import type {
  CompanyProfileStatus,
  ResearchResultView,
} from '@/entities/research/client';

import {
  DEFAULT_COMPANY_FILTER,
  filterAndSortCompanies,
  paginate,
  type CompanyBrowserFilter,
  type CompanyEmailFilter,
  type CompanyPhoneFilter,
  type CompanySort,
  type CompanyStatusFilter,
} from '../model/company-browser';
import {
  COMPANY_STATUS_LABELS,
  companiesLabel,
  resultAvailabilityMessage,
  unreadableDataMessage,
} from '../model/presentation';
import { CompanyCard } from './company-card';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: readonly CompanyProfileStatus[] = [
  'profiled',
  'needs_review',
  'rejected',
  'error',
];

const SORT_OPTIONS: readonly { value: CompanySort; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'offers', label: 'Most offers' },
  { value: 'domain', label: 'Domain A–Z' },
];

function toStatusFilter(value: string): CompanyStatusFilter {
  switch (value) {
    case 'profiled':
    case 'needs_review':
    case 'rejected':
    case 'error':
      return value;
    default:
      return 'all';
  }
}

function toEmailFilter(value: string): CompanyEmailFilter {
  return value === 'has' || value === 'none' ? value : 'all';
}

function toPhoneFilter(value: string): CompanyPhoneFilter {
  return value === 'has' || value === 'none' ? value : 'all';
}

function toSort(value: string): CompanySort {
  switch (value) {
    case 'name-desc':
    case 'offers':
    case 'domain':
      return value;
    default:
      return 'name';
  }
}

export function ResearchCompanies({ result }: { result: ResearchResultView }) {
  const id = useId();
  const [filter, setFilter] = useState<CompanyBrowserFilter>(
    DEFAULT_COMPANY_FILTER,
  );
  const [page, setPage] = useState(1);

  const companies = result.companies;

  const filtered = useMemo(
    () => filterAndSortCompanies(companies, filter),
    [companies, filter],
  );

  const pageData = paginate(filtered, page, PAGE_SIZE);

  if (result.state !== 'profiles') {
    return (
      <section className="card">
        <h2>Companies</h2>
        <p>{resultAvailabilityMessage(result)}</p>
      </section>
    );
  }

  const unreadable = unreadableDataMessage(result);
  const hasActiveFilters =
    filter.query.trim() !== '' ||
    filter.status !== DEFAULT_COMPANY_FILTER.status ||
    filter.email !== DEFAULT_COMPANY_FILTER.email ||
    filter.phone !== DEFAULT_COMPANY_FILTER.phone ||
    filter.sort !== DEFAULT_COMPANY_FILTER.sort;

  function updateFilter(patch: Partial<CompanyBrowserFilter>): void {
    setFilter((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function clearFilters(): void {
    setFilter(DEFAULT_COMPANY_FILTER);
    setPage(1);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Companies</h2>
        <span className="muted">{companiesLabel(companies.length)}</span>
      </div>

      {unreadable !== null && <p className="hint">{unreadable}</p>}

      <div className="filter-row">
        <div className="field filter-search">
          <label htmlFor={`${id}-search`}>Search companies</label>
          <input
            id={`${id}-search`}
            type="search"
            value={filter.query}
            placeholder="Name, domain, legal name or city"
            onChange={(event) => updateFilter({ query: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor={`${id}-status`}>Profiling status</label>
          <select
            id={`${id}-status`}
            value={filter.status}
            onChange={(event) =>
              updateFilter({ status: toStatusFilter(event.target.value) })
            }
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {COMPANY_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-email`}>Email availability</label>
          <select
            id={`${id}-email`}
            value={filter.email}
            onChange={(event) =>
              updateFilter({ email: toEmailFilter(event.target.value) })
            }
          >
            <option value="all">Any email availability</option>
            <option value="has">Has email address</option>
            <option value="none">No email address</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-phone`}>Phone availability</label>
          <select
            id={`${id}-phone`}
            value={filter.phone}
            onChange={(event) =>
              updateFilter({ phone: toPhoneFilter(event.target.value) })
            }
          >
            <option value="all">Any phone availability</option>
            <option value="has">Has telephone number</option>
            <option value="none">No telephone number</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-sort`}>Sort companies</label>
          <select
            id={`${id}-sort`}
            value={filter.sort}
            onChange={(event) =>
              updateFilter({ sort: toSort(event.target.value) })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="list-toolbar">
        <p className="muted" role="status" aria-live="polite">
          Showing {pageData.from}–{pageData.to} of {pageData.total} companies
          {pageData.total !== companies.length && (
            <> ({companies.length} total)</>
          )}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            className="button secondary small"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {pageData.items.length === 0 ? (
        <p className="muted">
          No companies match these filters.{' '}
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        </p>
      ) : (
        <>
          <ul className="company-list">
            {pageData.items.map((company) => (
              <li key={company.key}>
                <CompanyCard company={company} />
              </li>
            ))}
          </ul>

          {pageData.pageCount > 1 && (
            <nav className="pagination" aria-label="Company pages">
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
    </section>
  );
}
