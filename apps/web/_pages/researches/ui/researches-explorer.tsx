'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

import {
  RESULT_AVAILABILITY_LABELS,
  type ResearchListItem,
  type ResearchResultAvailability,
  type ResearchStatus,
} from '@/entities/research/client';
import {
  RESEARCH_STATUS_LABELS,
  ResearchStatusBadge,
} from '@/features/track-research';
import { formatDateTime, shortenId } from '@/shared/lib/format';

import {
  DEFAULT_RESEARCH_FILTER,
  filterResearches,
  researchResultSummary,
  sortResearches,
  type ResearchSort,
} from '../model/research-list';

const STATUSES: readonly ResearchStatus[] = [
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'INTERRUPTED',
];

const AVAILABILITIES: readonly ResearchResultAvailability[] = [
  'profiles',
  'empty',
  'historical',
  'not-completed',
  'unsupported',
];

const SORTS: readonly { value: ResearchSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'product', label: 'Product A–Z' },
  { value: 'companies', label: 'Most company profiles' },
  { value: 'offers', label: 'Most offers' },
];

function toStatusFilter(value: string): 'all' | ResearchStatus {
  switch (value) {
    case 'QUEUED':
    case 'RUNNING':
    case 'COMPLETED':
    case 'FAILED':
    case 'INTERRUPTED':
      return value;
    default:
      return 'all';
  }
}

function toAvailabilityFilter(
  value: string,
): 'all' | ResearchResultAvailability {
  switch (value) {
    case 'profiles':
    case 'empty':
    case 'historical':
    case 'not-completed':
    case 'unsupported':
      return value;
    default:
      return 'all';
  }
}

function toSort(value: string): ResearchSort {
  switch (value) {
    case 'oldest':
    case 'product':
    case 'companies':
    case 'offers':
      return value;
    default:
      return 'newest';
  }
}

function compareText(left: string, right: string): number {
  const normalisedLeft = left.toLocaleLowerCase('en');
  const normalisedRight = right.toLocaleLowerCase('en');

  if (normalisedLeft < normalisedRight) {
    return -1;
  }

  return normalisedLeft > normalisedRight ? 1 : 0;
}

type ResearchesExplorerProps = {
  items: ResearchListItem[];
};

export function ResearchesExplorer({ items }: ResearchesExplorerProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('all');
  const [country, setCountry] = useState('all');
  const [status, setStatus] = useState<'all' | ResearchStatus>('all');
  const [availability, setAvailability] = useState<
    'all' | ResearchResultAvailability
  >('all');
  const [sort, setSort] = useState<ResearchSort>('newest');

  const products = useMemo(() => {
    const names = new Map<string, string>();

    for (const item of items) {
      names.set(item.productId, item.productName ?? shortenId(item.productId));
    }

    return [...names.entries()].sort((left, right) =>
      compareText(left[1], right[1]),
    );
  }, [items]);

  const countries = useMemo(
    () => [...new Set(items.map((item) => item.country))].sort(compareText),
    [items],
  );

  const filtered = useMemo(
    () =>
      sortResearches(
        filterResearches(items, {
          query,
          productId,
          country,
          status,
          availability,
        }),
        sort,
      ),
    [items, query, productId, country, status, availability, sort],
  );

  const hasActiveFilters =
    query.trim() !== '' ||
    productId !== DEFAULT_RESEARCH_FILTER.productId ||
    country !== DEFAULT_RESEARCH_FILTER.country ||
    status !== DEFAULT_RESEARCH_FILTER.status ||
    availability !== DEFAULT_RESEARCH_FILTER.availability ||
    sort !== 'newest';

  function clearFilters(): void {
    setQuery(DEFAULT_RESEARCH_FILTER.query);
    setProductId(DEFAULT_RESEARCH_FILTER.productId);
    setCountry(DEFAULT_RESEARCH_FILTER.country);
    setStatus(DEFAULT_RESEARCH_FILTER.status);
    setAvailability(DEFAULT_RESEARCH_FILTER.availability);
    setSort('newest');
  }

  return (
    <>
      <div className="filter-row">
        <div className="field filter-search">
          <label htmlFor={`${id}-search`}>Search researches</label>
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            placeholder="Product, country or job id"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={`${id}-product`}>Product</label>
          <select
            id={`${id}-product`}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="all">All products</option>
            {products.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-country`}>Country</label>
          <select
            id={`${id}-country`}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            <option value="all">All countries</option>
            {countries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-status`}>Execution status</label>
          <select
            id={`${id}-status`}
            value={status}
            onChange={(event) => setStatus(toStatusFilter(event.target.value))}
          >
            <option value="all">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {RESEARCH_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-availability`}>Result availability</label>
          <select
            id={`${id}-availability`}
            value={availability}
            onChange={(event) =>
              setAvailability(toAvailabilityFilter(event.target.value))
            }
          >
            <option value="all">All results</option>
            {AVAILABILITIES.map((value) => (
              <option key={value} value={value}>
                {RESULT_AVAILABILITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-sort`}>Sort</label>
          <select
            id={`${id}-sort`}
            value={sort}
            onChange={(event) => setSort(toSort(event.target.value))}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="list-toolbar">
        <p className="muted" role="status" aria-live="polite">
          Showing {filtered.length} of {items.length} researches
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

      {filtered.length === 0 ? (
        <p className="muted">
          No researches match these filters.{' '}
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        </p>
      ) : (
        <ul className="product-list">
          {filtered.map((item) => (
            <li key={item.id} className="product-item research-list-item">
              <div>
                <h2>
                  <Link href={`/researches/${item.id}`}>
                    {item.productName ?? shortenId(item.productId)}
                  </Link>
                </h2>
                <p className="muted">
                  {item.country} · {formatDateTime(item.createdAt)} · job{' '}
                  {shortenId(item.id)}
                </p>
                <p className="muted">
                  {RESULT_AVAILABILITY_LABELS[item.resultState]}
                  {(item.resultState === 'profiles' ||
                    item.resultState === 'empty') && (
                    <> · {researchResultSummary(item)}</>
                  )}
                </p>
              </div>
              <ResearchStatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
