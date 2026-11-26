import { describe, expect, it } from 'vitest';

import type { CompanyProfileView } from '@/entities/research/client';

import {
  buildCompanyContactRows,
  contactTotals,
  filterContactRows,
} from './contact-browser';

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

const COMPANIES: CompanyProfileView[] = [
  company({
    emails: [
      {
        value: 'sales@alpha.test',
        label: 'sales',
        sourceUrl: 'https://alpha.test/contact',
      },
      {
        value: 'info@alpha.test',
        label: 'general',
        sourceUrl: null,
      },
    ],
    phones: [
      {
        value: '+370 600 00001',
        normalised: '+37060000001',
        label: 'sales',
        sourceUrl: null,
      },
    ],
  }),
  company({
    key: 'beta.test#1',
    domain: 'beta.test',
    name: 'Beta Wood',
    emails: [{ value: 'INFO@alpha.test', label: null, sourceUrl: null }],
  }),
  company({
    key: 'gamma.test#2',
    domain: 'gamma.test',
    name: 'Gamma Heat',
    phones: [
      {
        value: '+370 (600) 00001',
        normalised: null,
        label: null,
        sourceUrl: null,
      },
    ],
  }),
  company({
    key: 'delta.test#3',
    domain: 'delta.test',
    name: null,
  }),
];

describe('buildCompanyContactRows', () => {
  it('keeps only companies with contacts and preserves the relationship', () => {
    const rows = buildCompanyContactRows(COMPANIES);

    expect(rows.map((row) => row.company.domain)).toEqual([
      'alpha.test',
      'beta.test',
      'gamma.test',
    ]);
    expect(rows[0].emails).toHaveLength(2);
    expect(rows[0].phones).toHaveLength(1);
    expect(rows[0].displayName).toBe('Alpha Sauna');
  });
});

describe('contactTotals', () => {
  it('distinguishes contact values from unique values', () => {
    expect(contactTotals(COMPANIES)).toEqual({
      emailValues: 3,
      uniqueEmails: 2,
      phoneValues: 2,
      uniquePhones: 1,
      companiesWithEmail: 2,
      companiesWithPhone: 2,
    });
  });
});

describe('filterContactRows', () => {
  it('searches company identity and contact values', () => {
    const rows = buildCompanyContactRows(COMPANIES);

    expect(
      filterContactRows(rows, 'gamma', 'all').map((row) => row.company.domain),
    ).toEqual(['gamma.test']);
    expect(
      filterContactRows(rows, 'sales@alpha', 'all').map(
        (row) => row.company.domain,
      ),
    ).toEqual(['alpha.test']);
    expect(
      filterContactRows(rows, '00001', 'all').map((row) => row.company.domain),
    ).toEqual(['alpha.test', 'gamma.test']);
  });

  it('filters by contact type without losing the company relationship', () => {
    const rows = buildCompanyContactRows(COMPANIES);

    const emailRows = filterContactRows(rows, '', 'email');
    expect(emailRows.map((row) => row.company.domain)).toEqual([
      'alpha.test',
      'beta.test',
    ]);
    expect(emailRows[0].emails).toHaveLength(2);

    const phoneRows = filterContactRows(rows, '', 'phone');
    expect(phoneRows.map((row) => row.company.domain)).toEqual([
      'alpha.test',
      'gamma.test',
    ]);
    expect(phoneRows[1].phones[0].value).toBe('+370 (600) 00001');
  });
});
