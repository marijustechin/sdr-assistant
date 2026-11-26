import { describe, expect, it } from 'vitest';

import type { ResearchListItem } from '@/entities/research/client';

import {
  DEFAULT_RESEARCH_FILTER,
  filterResearches,
  researchResultSummary,
  sortResearches,
} from './research-list';

function item(overrides: Partial<ResearchListItem> = {}): ResearchListItem {
  return {
    id: 'research-1',
    productId: 'product-1',
    productName: 'Thermo Abachi Cladding',
    country: 'Lithuania',
    status: 'COMPLETED',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:10:00.000Z',
    resultState: 'historical',
    resultDetail: null,
    completedThrough: '02-page-collection',
    schemaVersion: null,
    companyCount: null,
    offerCount: null,
    unreadableProfiles: 0,
    ...overrides,
  };
}

const ITEMS: ResearchListItem[] = [
  item(),
  item({
    id: 'research-2',
    productId: 'product-2',
    productName: 'Industrial Catalogue',
    country: 'Germany',
    status: 'FAILED',
    createdAt: '2026-11-20T10:00:00.000Z',
    resultState: 'not-completed',
  }),
  item({
    id: 'research-3',
    productId: 'product-2',
    productName: 'Industrial Catalogue',
    country: 'Germany',
    createdAt: '2026-11-15T10:00:00.000Z',
    resultState: 'profiles',
    companyCount: 6,
    offerCount: 9,
  }),
  item({
    id: 'research-4',
    productId: 'product-3',
    productName: null,
    country: 'Latvia',
    createdAt: '2026-11-12T10:00:00.000Z',
    resultState: 'empty',
    companyCount: 0,
    offerCount: 0,
  }),
  item({
    id: 'research-5',
    productId: 'product-3',
    productName: null,
    country: 'Estonia',
    createdAt: '2026-11-11T10:00:00.000Z',
    resultState: 'unsupported',
    resultDetail: 'unknown-format',
  }),
];

function filter(overrides: Partial<typeof DEFAULT_RESEARCH_FILTER>) {
  return filterResearches(ITEMS, { ...DEFAULT_RESEARCH_FILTER, ...overrides });
}

describe('filterResearches', () => {
  it('searches product name, country, job id and status', () => {
    expect(filter({ query: 'industrial' })).toHaveLength(2);
    expect(filter({ query: 'latvia' }).map((entry) => entry.id)).toEqual([
      'research-4',
    ]);
    expect(filter({ query: 'research-5' }).map((entry) => entry.id)).toEqual([
      'research-5',
    ]);
    expect(filter({ query: 'failed' }).map((entry) => entry.id)).toEqual([
      'research-2',
    ]);
  });

  it('filters by product, country, execution status and result availability', () => {
    expect(filter({ productId: 'product-2' })).toHaveLength(2);
    expect(filter({ country: 'Germany' })).toHaveLength(2);
    expect(filter({ status: 'FAILED' })).toHaveLength(1);
    expect(
      filter({ availability: 'historical' }).map((entry) => entry.id),
    ).toEqual(['research-1']);
    expect(filter({ availability: 'empty' })).toHaveLength(1);
  });

  it('combines filters', () => {
    expect(
      filter({ productId: 'product-2', availability: 'profiles' }),
    ).toHaveLength(1);
    expect(filter({ country: 'Latvia', status: 'FAILED' })).toHaveLength(0);
  });
});

describe('sortResearches', () => {
  it('sorts newest first by default and supports oldest first', () => {
    expect(sortResearches(ITEMS, 'newest').map((entry) => entry.id)).toEqual([
      'research-2',
      'research-3',
      'research-4',
      'research-5',
      'research-1',
    ]);
    expect(sortResearches(ITEMS, 'oldest')[0].id).toBe('research-1');
  });

  it('sorts by product, company count and offer count without inventing counts', () => {
    expect(
      sortResearches(ITEMS, 'product').map((entry) => entry.productName),
    ).toEqual([
      'Industrial Catalogue',
      'Industrial Catalogue',
      null,
      null,
      'Thermo Abachi Cladding',
    ]);
    expect(sortResearches(ITEMS, 'companies')[0].id).toBe('research-3');
    expect(sortResearches(ITEMS, 'offers')[0].id).toBe('research-3');
  });
});

describe('researchResultSummary', () => {
  it('never presents an unavailable count as zero', () => {
    expect(researchResultSummary(item())).toBe(
      'Completed without persisted company profiles',
    );
    expect(researchResultSummary(item({ resultState: 'not-completed' }))).toBe(
      'No final result yet',
    );
    expect(researchResultSummary(item({ resultState: 'unsupported' }))).toBe(
      'Result unavailable',
    );
  });

  it('shows counts only when they are available', () => {
    expect(
      researchResultSummary(
        item({
          resultState: 'profiles',
          companyCount: 4,
          offerCount: 6,
        }),
      ),
    ).toBe('4 company profiles · 6 offers');
    expect(
      researchResultSummary(
        item({ resultState: 'empty', companyCount: 0, offerCount: 0 }),
      ),
    ).toBe('0 company profiles · 0 offers');
    expect(
      researchResultSummary(
        item({
          resultState: 'profiles',
          companyCount: 4,
          offerCount: 6,
          unreadableProfiles: 1,
        }),
      ),
    ).toContain('1 unreadable profile');
  });
});
