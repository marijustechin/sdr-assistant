import { describe, expect, it } from 'vitest';

import type {
  CompanyOfferView,
  CompanyPrice,
  CompanyProfileView,
} from '@/entities/research/client';

import {
  DEFAULT_MARKET_FILTER,
  buildMarketRows,
  buildMarketSummary,
  canCompareMarketPrices,
  filterAndSortMarketRows,
  marketPriceOptions,
  type MarketFilter,
} from './market-view';

function offer(overrides: Partial<CompanyOfferView> = {}): CompanyOfferView {
  return {
    key: 'offer-1',
    id: '03-0001',
    item: 'Synthetic offer',
    verdict: 'b',
    traits: [],
    pageIds: [],
    sourceUrl: null,
    marketFrom03: null,
    market: null,
    prices: [],
    ...overrides,
  };
}

function price(overrides: Partial<CompanyPrice> = {}): CompanyPrice {
  return {
    amount: 100,
    currency: 'EUR',
    unit: 'pc',
    vatIncluded: null,
    priceType: 'exact',
    variant: null,
    quote: null,
    sourceUrl: null,
    ...overrides,
  };
}

function company(
  overrides: Partial<CompanyProfileView> = {},
): CompanyProfileView {
  return {
    key: 'alpha.test#0',
    domain: 'alpha.test',
    registrableDomain: 'alpha.test',
    status: 'profiled',
    error: null,
    name: 'Alpha Sauna',
    legalName: null,
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

const ALPHA_OFFER = offer({
  key: 'alpha-offer-1',
  item: 'Sauna bench',
  verdict: 'a',
  prices: [
    price({
      amount: 1250,
      unit: 'm2',
      priceType: 'from',
      vatIncluded: true,
      variant: 'Bench A',
    }),
    price({ amount: 1490, unit: 'pc', variant: 'Bench B' }),
  ],
});

const COMPANIES: CompanyProfileView[] = [
  company({
    key: 'alpha.test#0',
    domain: 'alpha.test',
    name: 'Alpha Sauna',
    offers: [
      ALPHA_OFFER,
      offer({
        key: 'alpha-offer-2',
        item: 'Sauna cushion',
        verdict: 'b',
      }),
    ],
  }),
  company({
    key: 'beta.test#1',
    domain: 'beta.test',
    name: null,
    offers: [offer({ key: 'beta-offer-1', item: 'Cedar panel' })],
  }),
  company({
    key: 'gamma.test#2',
    domain: 'gamma.test',
    name: 'Gamma Heat',
    offers: [
      offer({
        key: 'gamma-offer-1',
        item: 'Heater',
        prices: [
          price({
            amount: 0,
            unit: 'pc',
            vatIncluded: false,
          }),
          price({
            amount: 5,
            currency: null,
            unit: null,
          }),
        ],
      }),
    ],
  }),
  company({
    key: 'delta.test#3',
    domain: 'delta.test',
    name: 'Delta Klamp',
    offers: [
      offer({
        key: 'delta-offer-1',
        item: 'Clamp',
        prices: [price({ amount: 89, currency: 'USD', unit: 'm' })],
      }),
    ],
  }),
];

function filter(overrides: Partial<MarketFilter> = {}): MarketFilter {
  return { ...DEFAULT_MARKET_FILTER, ...overrides };
}

function rows(overrides: Partial<MarketFilter> = {}) {
  return filterAndSortMarketRows(
    buildMarketRows(COMPANIES, overrides.priceAvailability ?? 'priced'),
    filter(overrides),
  );
}

describe('buildMarketSummary', () => {
  it('counts offers, priced offers and companies with prices', () => {
    expect(buildMarketSummary(COMPANIES)).toEqual({
      totalOffers: 5,
      offersWithPrices: 3,
      companiesWithPrices: 3,
    });
    expect(buildMarketSummary([])).toEqual({
      totalOffers: 0,
      offersWithPrices: 0,
      companiesWithPrices: 0,
    });
  });
});

describe('buildMarketRows', () => {
  it('creates one row per structured price entry', () => {
    const priced = buildMarketRows(COMPANIES, 'priced');

    expect(priced).toHaveLength(5);
    expect(
      priced.filter((row) => row.offer.key === ALPHA_OFFER.key),
    ).toHaveLength(2);
    expect(priced.every((row) => row.price !== null)).toBe(true);
    expect(new Set(priced.map((row) => row.key)).size).toBe(priced.length);
  });

  it('adds one unavailable row per unpriced offer only when requested', () => {
    expect(buildMarketRows(COMPANIES, 'priced')).toHaveLength(5);

    const all = buildMarketRows(COMPANIES, 'all');
    expect(all).toHaveLength(7);
    expect(all.filter((row) => row.price === null)).toHaveLength(2);
  });

  it('keeps a genuine zero price and never invents one for an unpriced offer', () => {
    const all = buildMarketRows(COMPANIES, 'all');
    const zero = all.find(
      (row) => row.companyKey === 'gamma.test#2' && row.price?.amount === 0,
    );
    const unpriced = all.find((row) => row.offer.key === 'beta-offer-1');

    expect(zero?.price?.amount).toBe(0);
    expect(unpriced?.price).toBeNull();
  });
});

describe('marketPriceOptions', () => {
  it('lists only recorded currencies and units, plus an honest unknown option', () => {
    const options = marketPriceOptions(COMPANIES);

    expect(options.currencies.map((option) => option.value)).toEqual([
      'EUR',
      'USD',
      'none',
    ]);
    expect(options.units.map((option) => option.value)).toEqual([
      'm',
      'm2',
      'pc',
      'none',
    ]);
    expect(options.units.find((option) => option.value === 'm2')?.label).toBe(
      'm²',
    );
    expect(options.units.find((option) => option.value === 'none')?.label).toBe(
      'Not recorded',
    );
  });
});

describe('market filters', () => {
  it('defaults to offers with structured prices', () => {
    expect(rows()).toHaveLength(5);
    expect(rows({ priceAvailability: 'all' })).toHaveLength(7);
  });

  it('searches company name, domain and product name', () => {
    expect(rows({ query: 'Alpha' })).toHaveLength(2);
    expect(rows({ query: 'beta.test', priceAvailability: 'all' })).toHaveLength(
      1,
    );
    expect(rows({ query: 'Heater' })).toHaveLength(2);
  });

  it('filters by the recorded product-match verdict', () => {
    expect(rows({ match: 'a' })).toHaveLength(2);
    expect(rows({ match: 'b' })).toHaveLength(3);
    expect(rows({ match: 'b', priceAvailability: 'all' })).toHaveLength(5);
  });

  it('filters by currency and unit, including an unrecorded value', () => {
    expect(rows({ currency: 'USD' })).toHaveLength(1);
    expect(rows({ currency: 'none' })).toHaveLength(1);
    expect(rows({ unit: 'pc' })).toHaveLength(2);
    expect(rows({ unit: 'none' })).toHaveLength(1);
    expect(rows({ currency: 'USD', unit: 'pc' })).toHaveLength(0);
  });
});

describe('market price comparability and sorting', () => {
  it('allows numeric comparisons only within one currency and one unit', () => {
    expect(canCompareMarketPrices(filter())).toBe(false);
    expect(canCompareMarketPrices(filter({ currency: 'EUR' }))).toBe(false);
    expect(
      canCompareMarketPrices(filter({ currency: 'EUR', unit: 'all' })),
    ).toBe(false);
    expect(
      canCompareMarketPrices(filter({ currency: 'none', unit: 'pc' })),
    ).toBe(false);
    expect(
      canCompareMarketPrices(filter({ currency: 'EUR', unit: 'pc' })),
    ).toBe(true);
  });

  it('sorts by company and product deterministically', () => {
    expect(rows().map((row) => row.companyName)).toEqual([
      'Alpha Sauna',
      'Alpha Sauna',
      'Delta Klamp',
      'Gamma Heat',
      'Gamma Heat',
    ]);
    expect(rows({ sort: 'product' }).map((row) => row.offer.item)).toEqual([
      'Clamp',
      'Heater',
      'Heater',
      'Sauna bench',
      'Sauna bench',
    ]);
  });

  it('sorts comparable prices ascending and descending', () => {
    const comparable = filter({
      currency: 'EUR',
      unit: 'pc',
      priceAvailability: 'all',
      sort: 'price-asc',
    });
    const ascending = filterAndSortMarketRows(
      buildMarketRows(COMPANIES, 'all'),
      comparable,
    );
    expect(ascending.map((row) => row.price?.amount ?? null)).toEqual([
      0, 1490,
    ]);

    const descending = filterAndSortMarketRows(
      buildMarketRows(COMPANIES, 'all'),
      { ...comparable, sort: 'price-desc' },
    );
    expect(descending.map((row) => row.price?.amount ?? null)).toEqual([
      1490, 0,
    ]);
  });

  it('falls back to company order when prices are not comparable', () => {
    expect(rows({ sort: 'price-asc' }).map((row) => row.companyName)).toEqual(
      rows().map((row) => row.companyName),
    );
  });
});
