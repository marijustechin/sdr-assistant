import type {
  CompanyProfileStatus,
  CompanyProfileView,
} from '@/entities/research/client';

import { companyDisplayName } from './presentation';

export type CompanyEmailFilter = 'all' | 'has' | 'none';
export type CompanyPhoneFilter = 'all' | 'has' | 'none';
export type CompanyStatusFilter = 'all' | CompanyProfileStatus;
export type CompanySort = 'name' | 'name-desc' | 'offers' | 'domain';

export type CompanyBrowserFilter = {
  query: string;
  status: CompanyStatusFilter;
  email: CompanyEmailFilter;
  phone: CompanyPhoneFilter;
  sort: CompanySort;
};

export const DEFAULT_COMPANY_FILTER: CompanyBrowserFilter = {
  query: '',
  status: 'all',
  email: 'all',
  phone: 'all',
  sort: 'name',
};

function normalise(value: string): string {
  return value.toLocaleLowerCase('en');
}

function matchesQuery(company: CompanyProfileView, query: string): boolean {
  const needle = normalise(query.trim());

  if (needle === '') {
    return true;
  }

  const haystack = [
    companyDisplayName(company),
    company.name ?? '',
    company.legalName ?? '',
    company.domain,
    company.registrableDomain ?? '',
    company.city ?? '',
    company.country ?? '',
  ];

  return haystack.some((value) => normalise(value).includes(needle));
}

function compareText(left: string, right: string): number {
  const normalisedLeft = normalise(left);
  const normalisedRight = normalise(right);

  if (normalisedLeft < normalisedRight) {
    return -1;
  }

  return normalisedLeft > normalisedRight ? 1 : 0;
}

function compareNames(
  left: CompanyProfileView,
  right: CompanyProfileView,
): number {
  return compareText(companyDisplayName(left), companyDisplayName(right));
}

function sortCompanies(
  companies: readonly CompanyProfileView[],
  sort: CompanySort,
): CompanyProfileView[] {
  const sorted = [...companies];

  switch (sort) {
    case 'name-desc':
      return sorted.sort((left, right) => compareNames(right, left));
    case 'offers':
      return sorted.sort(
        (left, right) =>
          right.offers.length - left.offers.length || compareNames(left, right),
      );
    case 'domain':
      return sorted.sort((left, right) =>
        compareText(left.domain, right.domain),
      );
    case 'name':
      return sorted.sort(compareNames);
  }
}

/** Local search, filtering and sorting over the displayed company profiles. */
export function filterAndSortCompanies(
  companies: readonly CompanyProfileView[],
  filter: CompanyBrowserFilter,
): CompanyProfileView[] {
  const matching = companies.filter((company) => {
    if (!matchesQuery(company, filter.query)) {
      return false;
    }

    if (filter.status !== 'all' && company.status !== filter.status) {
      return false;
    }

    if (filter.email === 'has' && company.emails.length === 0) {
      return false;
    }

    if (filter.email === 'none' && company.emails.length > 0) {
      return false;
    }

    if (filter.phone === 'has' && company.phones.length === 0) {
      return false;
    }

    if (filter.phone === 'none' && company.phones.length > 0) {
      return false;
    }

    return true;
  });

  return sortCompanies(matching, filter.sort);
}

export type Page<T> = {
  items: T[];
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
};

/** Clamps the requested page to the available range and slices it. */
export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
): Page<T> {
  const total = items.length;
  const pageCount = total === 0 ? 1 : Math.ceil(total / pageSize);
  const page = Math.min(Math.max(requestedPage, 1), pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    total,
  };
}
