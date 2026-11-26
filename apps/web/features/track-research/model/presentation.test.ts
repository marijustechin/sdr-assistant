import { describe, expect, it } from 'vitest';

import type {
  CompanyPrice,
  CompanyProfileView,
  ResearchResultView,
} from '@/entities/research/client';

import {
  companyDisplayName,
  formatPrice,
  formatPriceAmount,
  productMatchLabel,
  resultAvailabilityMessage,
  unreadableDataMessage,
  unitLabel,
  vatLabel,
} from './presentation';

const PRICE: CompanyPrice = {
  amount: 1250,
  currency: 'EUR',
  unit: 'm2',
  vatIncluded: true,
  priceType: 'from',
  variant: 'Bench A',
  quote: null,
  sourceUrl: null,
};

function result(
  overrides: Partial<ResearchResultView> = {},
): ResearchResultView {
  return {
    state: 'profiles',
    detail: null,
    schemaVersion: 1,
    completedThrough: '04-company-profiling',
    resultsPerQuery: 40,
    summary: null,
    companies: [],
    unreadableProfiles: 0,
    unreadableOffers: 0,
    unreadablePrices: 0,
    legacyNote: null,
    ...overrides,
  };
}

describe('formatPrice', () => {
  it('renders the recorded amount, currency, unit, VAT and variant', () => {
    expect(formatPrice(PRICE)).toBe('From 1,250 EUR/m² · incl. VAT · Bench A');
  });

  it('renders a genuine zero amount and omits missing details', () => {
    expect(
      formatPrice({
        ...PRICE,
        amount: 0,
        currency: null,
        unit: null,
        vatIncluded: null,
        priceType: 'exact',
        variant: null,
      }),
    ).toBe('0');
  });
});

describe('market labels', () => {
  it('keeps amount, currency, unit and VAT available as separate values', () => {
    expect(formatPriceAmount(PRICE)).toBe('From 1,250');
    expect(formatPriceAmount({ ...PRICE, amount: 0, priceType: 'exact' })).toBe(
      '0',
    );
    expect(unitLabel('m2')).toBe('m²');
    expect(unitLabel(null)).toBe('Not recorded');
    expect(vatLabel(true)).toBe('Included');
    expect(vatLabel(false)).toBe('Excluded');
    expect(vatLabel(null)).toBe('Not recorded');
  });

  it('uses the confirmed PRODUCT.md match semantics', () => {
    expect(productMatchLabel('a')).toBe('Exact product (a)');
    expect(productMatchLabel('b')).toBe('Category match (b)');
    expect(productMatchLabel(null)).toBe('Not recorded');
  });
});

describe('result messages', () => {
  it('explains each result state without inventing data', () => {
    expect(resultAvailabilityMessage(result())).toContain(
      'Company profiles are available for 0 companies.',
    );
    expect(resultAvailabilityMessage(result({ state: 'empty' }))).toContain(
      'valid empty result',
    );
    expect(
      resultAvailabilityMessage(
        result({ state: 'historical', completedThrough: '02-page-collection' }),
      ),
    ).toContain('02-page-collection');
    expect(
      resultAvailabilityMessage(result({ state: 'not-completed' })),
    ).toContain('has not completed');
    expect(
      resultAvailabilityMessage(
        result({ state: 'unsupported', detail: 'missing-result' }),
      ),
    ).toContain('No result was stored');
  });

  it('counts unreadable records that are not shown', () => {
    expect(
      unreadableDataMessage(
        result({
          unreadableProfiles: 1,
          unreadableOffers: 2,
          unreadablePrices: 0,
        }),
      ),
    ).toBe(
      '1 company profile could not be read and is not shown. 2 offer records could not be read and are not shown.',
    );
    expect(unreadableDataMessage(result())).toBeNull();
  });
});

describe('companyDisplayName', () => {
  it('falls back to the domain only when the name is missing', () => {
    const company: CompanyProfileView = {
      key: 'alpha.test#0',
      domain: 'alpha.test',
      registrableDomain: null,
      status: 'profiled',
      error: null,
      name: null,
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
    };

    expect(companyDisplayName(company)).toBe('alpha.test');
    expect(companyDisplayName({ ...company, name: 'Alpha Sauna' })).toBe(
      'Alpha Sauna',
    );
  });
});
