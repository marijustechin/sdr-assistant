import { describe, expect, it } from 'vitest';

import type { ResearchResponse } from './schema';
import {
  RESULT_AVAILABILITY_LABELS,
  parseResearchResult,
  toResearchListItem,
} from './result';

function research(overrides: Partial<ResearchResponse> = {}): ResearchResponse {
  return {
    id: 'research-1',
    productId: 'product-1',
    country: 'Lithuania',
    status: 'COMPLETED',
    stage: null,
    result: null,
    error: null,
    lastHeartbeatAt: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:10:00.000Z',
    ...overrides,
  };
}

function profile(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    domain: 'alpha-sauna.test',
    registrableDomain: 'alpha-sauna.test',
    status: 'profiled',
    company: {
      name: 'Alpha Sauna OÜ',
      legalName: 'Alpha Sauna OÜ',
      code: '12345678',
      vat: 'EE12345678',
      address: 'Synthetic 1',
      city: 'Tallinn',
      country: 'Estonia',
      emails: [
        {
          value: 'sales@alpha-sauna.test',
          label: 'sales',
          sourceUrl: 'https://alpha-sauna.test/contact',
        },
      ],
      phones: [
        {
          value: '+372 6000 0001',
          normalised: '+37260000001',
          label: null,
          sourceUrl: 'https://alpha-sauna.test/contact',
        },
      ],
      contactFormUrl: 'https://alpha-sauna.test/contact',
      sources: ['https://alpha-sauna.test'],
    },
    offers: [
      {
        id: '03-0001',
        item: 'Synthetic sauna bench',
        verdict: 'a',
        traits: {
          medienos_rusis: 'confirmed',
          apdorojimas: 'differs',
        },
        pageIds: ['03-0001'],
        sourceUrl: 'https://alpha-sauna.test/bench',
        marketFrom03: {
          status: 'target',
          note: 'Synthetic note',
          sourceUrl: 'https://alpha-sauna.test/bench',
          quote: 'Synthetic quote',
        },
        market: {
          status: 'target',
          resolvedBy: 'evidence',
          basis: '03',
          evidence: [
            {
              channel: 'delivery',
              direction: 'allows',
              scope: 'domain',
              appliesTo: ['03-0001'],
              quote: 'Synthetic delivery quote',
              sourceUrl: 'https://alpha-sauna.test/delivery',
            },
          ],
          channels: {
            delivery: 'open',
            pickup: 'unknown',
            purchase: 'unknown',
          },
          conflict: false,
        },
        prices: [
          {
            amount: 1250,
            currency: 'EUR',
            unit: 'm2',
            vatIncluded: true,
            priceType: 'from',
            variant: 'Bench A',
            quote: 'Synthetic price quote',
            sourceUrl: 'https://alpha-sauna.test/bench',
          },
        ],
      },
    ],
    usage: {
      llmCalls: 2,
      promptTokens: 100,
      completionTokens: 50,
      fetches: 1,
      fetchCredits: null,
      durationMs: 1000,
    },
    ...overrides,
  };
}

const versionedResult = {
  schemaVersion: 1,
  completedThrough: '04-company-profiling',
  resultsPerQuery: 40,
  summary: {
    domains: 1,
    errors: 0,
    newLlmCalls: 2,
    unexpectedStatistic: 99,
  },
  companies: [profile()],
};

describe('parseResearchResult', () => {
  it('reads the versioned final result, its metadata and dynamic traits', () => {
    const parsed = parseResearchResult(research({ result: versionedResult }));

    expect(parsed.state).toBe('profiles');
    expect(parsed.detail).toBeNull();
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.completedThrough).toBe('04-company-profiling');
    expect(parsed.resultsPerQuery).toBe(40);
    expect(parsed.summary).toEqual({
      domains: 1,
      errors: 0,
      newLlmCalls: 2,
    });
    expect(parsed.companies).toHaveLength(1);

    const company = parsed.companies[0];
    expect(company.domain).toBe('alpha-sauna.test');
    expect(company.name).toBe('Alpha Sauna OÜ');
    expect(company.emails).toHaveLength(1);
    expect(company.phones[0].normalised).toBe('+37260000001');
    expect(company.offers).toHaveLength(1);

    const offer = company.offers[0];
    expect(offer.verdict).toBe('a');
    expect(offer.traits).toEqual([
      { key: 'medienos_rusis', value: 'confirmed' },
      { key: 'apdorojimas', value: 'differs' },
    ]);
    expect(offer.prices[0].amount).toBe(1250);
    expect(offer.market?.status).toBe('target');
    expect(offer.market?.channels).toEqual([
      { channel: 'delivery', state: 'open' },
      { channel: 'pickup', state: 'unknown' },
      { channel: 'purchase', state: 'unknown' },
    ]);
  });

  it('reads historical unversioned results that contain companies', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          completedThrough: '04-company-discovery',
          companies: [profile(), profile({ domain: 'beta-wood.test' })],
        },
      }),
    );

    expect(parsed.state).toBe('profiles');
    expect(parsed.schemaVersion).toBeNull();
    expect(parsed.completedThrough).toBe('04-company-discovery');
    expect(parsed.companies).toHaveLength(2);
  });

  it('treats a present empty companies array as a valid completed result', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies: [],
        },
      }),
    );

    expect(parsed.state).toBe('empty');
    expect(parsed.companies).toEqual([]);

    const item = toResearchListItem(
      research({ result: { companies: [] } }),
      'P',
    );
    expect(item.companyCount).toBe(0);
    expect(item.offerCount).toBe(0);
  });

  it('distinguishes a historical result without companies from zero companies', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          completedThrough: '02-page-collection',
          identificationPageCount: 12,
          selectedPageCount: 5,
          resultsPerQuery: 20,
        },
      }),
    );

    expect(parsed.state).toBe('historical');
    expect(parsed.completedThrough).toBe('02-page-collection');
    expect(parsed.resultsPerQuery).toBe(20);
    expect(parsed.companies).toEqual([]);

    const item = toResearchListItem(
      research({
        result: {
          completedThrough: '02-page-collection',
          resultsPerQuery: 20,
        },
      }),
      'Thermo Abachi Cladding',
    );
    expect(item.companyCount).toBeNull();
    expect(item.offerCount).toBeNull();
    expect(item.productName).toBe('Thermo Abachi Cladding');
  });

  it('reports a null completed result as missing rather than empty', () => {
    const parsed = parseResearchResult(research({ result: null }));

    expect(parsed.state).toBe('unsupported');
    expect(parsed.detail).toBe('missing-result');
    expect(parsed.companies).toEqual([]);
  });

  it('reports unknown object shapes and arrays as unsupported', () => {
    expect(
      parseResearchResult(research({ result: { unexpected: 'shape' } })),
    ).toMatchObject({ state: 'unsupported', detail: 'unknown-format' });

    expect(
      parseResearchResult(
        research({ result: [{ domain: 'not-an-envelope' }] }),
      ),
    ).toMatchObject({ state: 'unsupported', detail: 'unknown-format' });
  });

  it('rejects a schema version it does not understand', () => {
    const parsed = parseResearchResult(
      research({
        result: { ...versionedResult, schemaVersion: 2 },
      }),
    );

    expect(parsed.state).toBe('unsupported');
    expect(parsed.detail).toBe('unsupported-version');
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.companies).toEqual([]);
  });

  it('rejects a versioned envelope without a readable companies array', () => {
    expect(
      parseResearchResult(
        research({
          result: {
            schemaVersion: 1,
            completedThrough: '04-company-profiling',
            companies: 'not-an-array',
          },
        }),
      ),
    ).toMatchObject({ state: 'unsupported', detail: 'malformed-companies' });

    expect(
      parseResearchResult(
        research({
          result: {
            schemaVersion: 1,
            completedThrough: '04-company-profiling',
          },
        }),
      ),
    ).toMatchObject({ state: 'unsupported', detail: 'malformed-companies' });
  });

  it('keeps readable profiles when individual profiles are malformed', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies: [
            profile(),
            { status: 'profiled' },
            { domain: 'broken.test', status: 'profiled' },
          ],
        },
      }),
    );

    expect(parsed.state).toBe('profiles');
    expect(parsed.companies).toHaveLength(1);
    expect(parsed.unreadableProfiles).toBe(2);

    const item = toResearchListItem(
      research({
        result: {
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies: [profile(), { status: 'profiled' }],
        },
      }),
      null,
    );
    expect(item.companyCount).toBe(1);
    expect(item.unreadableProfiles).toBe(1);
  });

  it('reports profiles that are all unreadable as unsupported', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies: [{ status: 'profiled' }, null],
        },
      }),
    );

    expect(parsed.state).toBe('unsupported');
    expect(parsed.detail).toBe('unreadable-profiles');
    expect(parsed.unreadableProfiles).toBe(2);
  });

  it('supports partial identity and contact information', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          companies: [
            {
              domain: 'partial.test',
              status: 'needs_review',
              company: {
                name: 'Partial Ltd',
                emails: [{ value: 'info@partial.test' }],
                phones: [{ value: '+370 600 00002' }],
              },
              offers: [],
            },
          ],
        },
      }),
    );

    const company = parsed.companies[0];
    expect(company.name).toBe('Partial Ltd');
    expect(company.legalName).toBeNull();
    expect(company.code).toBeNull();
    expect(company.vat).toBeNull();
    expect(company.address).toBeNull();
    expect(company.city).toBeNull();
    expect(company.country).toBeNull();
    expect(company.contactFormUrl).toBeNull();
    expect(company.emails[0].label).toBeNull();
    expect(company.emails[0].sourceUrl).toBeNull();
    expect(company.phones[0].normalised).toBeNull();
    expect(company.offers).toEqual([]);
  });

  it('supports the historical string marketFrom03 and missing offer source/prices', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          completedThrough: '04-company-discovery',
          companies: [
            profile({
              status: 'needs_review',
              company: { name: 'Legacy Ltd' },
              offers: [
                {
                  id: '03-0002',
                  item: 'Legacy offer',
                  verdict: 'b',
                  traits: { material: 'unknown' },
                  pageIds: [],
                  marketFrom03: 'Legacy market note from stage 03.',
                  market: {
                    status: 'unclear',
                    resolvedBy: 'none',
                    evidence: [],
                    channels: {},
                    conflict: false,
                  },
                },
              ],
            }),
          ],
        },
      }),
    );

    const offer = parsed.companies[0].offers[0];
    expect(offer.sourceUrl).toBeNull();
    expect(offer.prices).toEqual([]);
    expect(offer.marketFrom03).toEqual({
      kind: 'text',
      text: 'Legacy market note from stage 03.',
    });
    expect(offer.traits).toEqual([{ key: 'material', value: 'unknown' }]);
  });

  it('keeps missing prices apart from a genuine zero amount', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          companies: [
            profile({
              offers: [
                {
                  item: 'Offer without price',
                  verdict: 'b',
                  prices: [],
                },
                {
                  item: 'Offer with zero price',
                  verdict: 'b',
                  prices: [{ amount: 0, currency: 'EUR' }],
                },
              ],
            }),
          ],
        },
      }),
    );

    const [withoutPrice, zeroPrice] = parsed.companies[0].offers;
    expect(withoutPrice.prices).toEqual([]);
    expect(zeroPrice.prices).toHaveLength(1);
    expect(zeroPrice.prices[0].amount).toBe(0);
  });

  it('counts unreadable offers and prices without dropping the profile', () => {
    const parsed = parseResearchResult(
      research({
        result: {
          companies: [
            profile({
              offers: [
                {
                  item: 'Readable offer',
                  verdict: 'a',
                  prices: [
                    { amount: 10, currency: 'EUR' },
                    { currency: 'EUR' },
                  ],
                },
                { verdict: 'a' },
              ],
            }),
          ],
        },
      }),
    );

    expect(parsed.state).toBe('profiles');
    expect(parsed.companies[0].offers).toHaveLength(1);
    expect(parsed.unreadableOffers).toBe(1);
    expect(parsed.unreadablePrices).toBe(1);
  });

  it('handles a legacy string result and a not-completed research', () => {
    const legacy = parseResearchResult(
      research({
        result: 'Company discovery finished: 12 companies, 9 with a domain.',
      }),
    );
    expect(legacy.state).toBe('historical');
    expect(legacy.legacyNote).toBe(
      'Company discovery finished: 12 companies, 9 with a domain.',
    );

    const running = parseResearchResult(
      research({
        status: 'RUNNING',
        result: { schemaVersion: 1, companies: [profile()] },
      }),
    );
    expect(running.state).toBe('not-completed');
    expect(running.companies).toEqual([]);
    expect(
      toResearchListItem(research({ status: 'RUNNING' }), 'P'),
    ).toMatchObject({
      companyCount: null,
      offerCount: null,
      resultState: 'not-completed',
    });
  });

  it('preserves large result sets and long text without truncation', () => {
    const longNote = 'x'.repeat(25_000);
    const companies = Array.from({ length: 120 }, (value, index) =>
      profile({
        domain: `company-${index}.test`,
        company: { name: `Company ${index}` },
        offers: [
          {
            item: `Offer ${index}`,
            verdict: 'b',
            marketFrom03: {
              status: 'unclear',
              note: longNote,
              sourceUrl: 'https://company.test/offer',
              quote: longNote,
            },
            market: { status: 'unclear', evidence: [], channels: {} },
            prices: [],
          },
        ],
      }),
    );

    const parsed = parseResearchResult(
      research({
        result: {
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies,
        },
      }),
    );

    expect(parsed.companies).toHaveLength(120);
    expect(parsed.companies[0].offers[0].marketFrom03).toMatchObject({
      kind: 'details',
      quote: longNote,
    });
  });

  it('offers stable availability labels for every state', () => {
    expect(Object.keys(RESULT_AVAILABILITY_LABELS).sort()).toEqual(
      [
        'empty',
        'historical',
        'not-completed',
        'profiles',
        'unsupported',
      ].sort(),
    );
  });
});
