import { describe, expect, it } from 'vitest';

import type { CompanyProfileView } from '@/entities/research/client';

import {
  DEFAULT_COMPANY_FILTER,
  filterAndSortCompanies,
  paginate,
} from './company-browser';

function company(
  overrides: Partial<CompanyProfileView> = {},
): CompanyProfileView {
  const domain = overrides.domain ?? 'alpha.test';

  return {
    key: `${domain}#0`,
    domain,
    registrableDomain: domain,
    status: 'profiled',
    error: null,
    name: 'Alpha Sauna',
    legalName: 'Alpha Legal',
    code: null,
    vat: null,
    address: null,
    city: null,
    country: null,
    contactFormUrl: null,
    emails: [],
    phones: [],
    sources: [],
    offers: [],
    unreadableOffers: 0,
    unreadablePrices: 0,
    ...overrides,
  };
}

const EMPTY_OFFER = {
  key: '',
  id: null,
  item: '',
  verdict: null,
  traits: [],
  pageIds: [],
  sourceUrl: null,
  marketFrom03: null,
  market: null,
  prices: [],
};

const COMPANIES: CompanyProfileView[] = [
  company({
    key: 'alpha.test#0',
    domain: 'alpha.test',
    name: 'Alpha Sauna',
    legalName: 'Alpha Legal',
    emails: [
      {
        value: 'sales@alpha.test',
        label: 'sales',
        sourceUrl: 'https://alpha.test/contact',
      },
    ],
    phones: [
      {
        value: '+370 600 00001',
        normalised: '+37060000001',
        label: null,
        sourceUrl: null,
      },
    ],
    offers: [
      { ...EMPTY_OFFER, key: 'offer-1', item: 'Offer 1' },
      { ...EMPTY_OFFER, key: 'offer-2', item: 'Offer 2' },
    ],
  }),
  company({
    key: 'beta.test#1',
    domain: 'beta.test',
    name: 'Beta Wood',
    legalName: null,
    status: 'needs_review',
    phones: [
      {
        value: '+370 600 00002',
        normalised: null,
        label: 'general',
        sourceUrl: null,
      },
    ],
  }),
  company({
    key: 'gamma.test#2',
    domain: 'gamma.test',
    name: 'Gamma Heat',
    legalName: 'Gamma Legal',
    status: 'rejected',
    emails: [
      {
        value: 'info@gamma.test',
        label: null,
        sourceUrl: null,
      },
    ],
    offers: [{ ...EMPTY_OFFER, key: 'offer-3', item: 'Offer 3' }],
  }),
  company({
    key: 'delta.test#3',
    domain: 'delta.test',
    name: null,
    legalName: null,
    status: 'error',
  }),
];

function apply(overrides: Partial<typeof DEFAULT_COMPANY_FILTER>) {
  return filterAndSortCompanies(COMPANIES, {
    ...DEFAULT_COMPANY_FILTER,
    ...overrides,
  });
}

describe('filterAndSortCompanies', () => {
  it('searches the trading name, domain, legal name and identity fields', () => {
    expect(apply({ query: 'alpha' }).map((entry) => entry.domain)).toEqual([
      'alpha.test',
    ]);
    expect(apply({ query: 'beta.test' }).map((entry) => entry.domain)).toEqual([
      'beta.test',
    ]);
    expect(
      apply({ query: 'Gamma Legal' }).map((entry) => entry.domain),
    ).toEqual(['gamma.test']);
    expect(apply({ query: ' Delta ' }).map((entry) => entry.domain)).toEqual([
      'delta.test',
    ]);
  });

  it('filters by the documented profiling statuses', () => {
    expect(apply({ status: 'profiled' })).toHaveLength(1);
    expect(apply({ status: 'needs_review' })).toHaveLength(1);
    expect(apply({ status: 'rejected' })).toHaveLength(1);
    expect(apply({ status: 'error' })).toHaveLength(1);
  });

  it('filters by email and phone availability', () => {
    expect(apply({ email: 'has' }).map((entry) => entry.domain)).toEqual([
      'alpha.test',
      'gamma.test',
    ]);
    expect(apply({ email: 'none' }).map((entry) => entry.domain)).toEqual([
      'beta.test',
      'delta.test',
    ]);
    expect(apply({ phone: 'has' }).map((entry) => entry.domain)).toEqual([
      'alpha.test',
      'beta.test',
    ]);
    expect(apply({ phone: 'none' }).map((entry) => entry.domain)).toEqual([
      'delta.test',
      'gamma.test',
    ]);
  });

  it('combines search, filters and sorting', () => {
    expect(
      apply({ email: 'has', sort: 'offers' }).map((entry) => entry.domain),
    ).toEqual(['alpha.test', 'gamma.test']);
  });

  it('sorts by name, domain and offer count', () => {
    expect(apply({ sort: 'name' }).map((entry) => entry.name)).toEqual([
      'Alpha Sauna',
      'Beta Wood',
      null,
      'Gamma Heat',
    ]);
    expect(apply({ sort: 'name-desc' }).map((entry) => entry.name)).toEqual([
      'Gamma Heat',
      null,
      'Beta Wood',
      'Alpha Sauna',
    ]);
    expect(apply({ sort: 'domain' }).map((entry) => entry.domain)).toEqual([
      'alpha.test',
      'beta.test',
      'delta.test',
      'gamma.test',
    ]);
    expect(apply({ sort: 'offers' }).map((entry) => entry.domain)).toEqual([
      'alpha.test',
      'gamma.test',
      'beta.test',
      'delta.test',
    ]);
  });
});

describe('paginate', () => {
  it('slices the visible page and reports the visible range', () => {
    const first = paginate(COMPANIES, 1, 2);
    expect(first.items).toHaveLength(2);
    expect(first).toMatchObject({
      page: 1,
      pageCount: 2,
      from: 1,
      to: 2,
      total: 4,
    });

    const second = paginate(COMPANIES, 2, 2);
    expect(second.items).toHaveLength(2);
    expect(second.from).toBe(3);
    expect(second.to).toBe(4);
  });

  it('clamps an out-of-range page and handles an empty list', () => {
    expect(paginate(COMPANIES, 99, 2).page).toBe(2);
    expect(paginate(COMPANIES, 0, 2).page).toBe(1);

    const empty = paginate([], 4, 20);
    expect(empty).toMatchObject({
      items: [],
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
    });
  });
});
