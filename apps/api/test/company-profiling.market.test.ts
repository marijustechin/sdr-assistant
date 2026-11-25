import { describe, expect, it } from 'vitest';

import { deriveMarket } from '../src/modules/research/stages/04-company-profiling/company-profiling.market';
import type {
  ChannelState,
  MarketChannel,
  MarketEvidence,
  MarketStatus,
} from '../src/modules/research/stages/04-company-profiling/company-profiling.types';

const OFFER = '03-0001';
const OTHER_OFFER = '03-0002';

type QuoteInput = {
  channel: MarketEvidence['channel'];
  direction: MarketEvidence['direction'];
  scope: MarketEvidence['scope'];
  quote: string;
  appliesTo?: string[];
  sourceUrl?: string;
};

function quote(input: QuoteInput): MarketEvidence {
  return {
    channel: input.channel,
    direction: input.direction,
    scope: input.scope,
    quote: input.quote,
    appliesTo: input.appliesTo ?? [OFFER],
    sourceUrl: input.sourceUrl ?? 'https://pvz.lt/pristatymas/',
  };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];

  const result: T[][] = [];
  for (let index = 0; index < items.length; index += 1) {
    const head = items[index]!;
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) result.push([head, ...tail]);
  }

  return result;
}

/**
 * The four market cases the client wrote down before the code existed. They are
 * the reason this function is pure: every case is checked without a paid call.
 */
describe('deriveMarket — the four client cases', () => {
  it('a seller-wide delivery promise does not cover a variant that is excluded', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'delivery',
        direction: 'allows',
        scope: 'domain',
        quote: 'Pristatome visoje ES',
      }),
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'offer',
        quote: '3 m lentų į Lietuvą nepristatome',
      }),
    ]);

    // No pickup information: the general promise is out, but the offer is not
    // proven unavailable either.
    expect(decision.status).toBe('unclear');
    expect(decision.channels).toEqual({
      delivery: 'closed',
      pickup: 'unknown',
      purchase: 'unknown',
    });
    expect(decision.resolvedBy).toBe('evidence');
  });

  it('pickup in Vilnius opens an offer whose delivery is closed', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'offer',
        quote: '3 m lentų į Lietuvą nepristatome',
      }),
      quote({
        channel: 'pickup',
        direction: 'allows',
        scope: 'offer',
        quote: 'Atsiėmimas Vilniuje: Ateities g. 33',
      }),
    ]);

    expect(decision.status).toBe('target');
    expect(decision.channels).toEqual({
      delivery: 'closed',
      pickup: 'open',
      purchase: 'unknown',
    });
  });

  it('"buyable only in Poland" closes the whole offer', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'purchase',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Šią prekę galima įsigyti tik Lenkijoje.',
      }),
    ]);

    expect(decision.status).toBe('other');
    expect(decision.channels.purchase).toBe('closed');
  });

  it('no supporting quote leaves the market unclear even when stage 03 said target', () => {
    const decision = deriveMarket(OFFER, []);

    // `marketFrom03: 'target'` is stored next to this decision, never merged
    // into it: an earlier model conclusion is not a confirmed fact.
    expect(decision.status).toBe('unclear');
    expect(decision.resolvedBy).toBe('none');
    expect(decision.evidence).toEqual([]);
    expect(decision.channels).toEqual({
      delivery: 'unknown',
      pickup: 'unknown',
      purchase: 'unknown',
    });
  });
});

describe('deriveMarket — stage 03 basis preservation', () => {
  const marketFrom03 = {
    status: 'target' as const,
    note: 'Atsiėmimas Vilniuje.',
    sourceUrl: 'https://pvz.lt/',
    quote: 'Atsiėmimas Vilniuje.',
  };

  it('does not confirm a 03 target from its quote alone', () => {
    const decision = deriveMarket(OFFER, [], marketFrom03);

    expect(decision.status).toBe('unclear');
    expect(decision.basis).toBe('03');
    expect(decision.diagnostics).toContain('03_market_target_unverified');
  });

  it('a price quote from 03 does not become a market confirmation', () => {
    const decision = deriveMarket(
      OFFER,
      [],
      {
        status: 'target',
        note: 'Vnt. kaina su PVM: €9,80',
        sourceUrl: 'https://geroslentos.lt/',
        quote: 'Vnt. kaina su PVM: €9,80',
      },
    );

    expect(decision.status).toBe('unclear');
    expect(decision.basis).toBe('03');
    expect(decision.diagnostics).toContain('03_market_target_unverified');
  });

  it('confirms a 03 target when 04 finds an independent local pickup', () => {
    const decision = deriveMarket(
      OFFER,
      [
        quote({
          channel: 'pickup',
          direction: 'allows',
          scope: 'offer',
          quote: 'Atsiėmimas Vilniuje: Ateities g. 33',
        }),
      ],
      { ...marketFrom03, quote: null },
    );

    expect(decision.status).toBe('target');
    expect(decision.basis).toBe('04');
    expect(decision.diagnostics).toContain('04_market_target_confirmed');
  });

  it('marks a 03 target with no recoverable basis as basis_missing', () => {
    const decision = deriveMarket(
      OFFER,
      [],
      { ...marketFrom03, quote: null },
    );

    expect(decision.status).toBe('unclear');
    expect(decision.basis).toBe('03');
    expect(decision.diagnostics).toContain('03_market_basis_missing');
  });

  it('marks delivery-only evidence as 03_market_target_from_delivery', () => {
    const decision = deriveMarket(
      OFFER,
      [
        quote({
          channel: 'delivery',
          direction: 'allows',
          scope: 'domain',
          quote: 'Pristatome visoje ES.',
        }),
      ],
      { ...marketFrom03, quote: null },
    );

    expect(decision.status).toBe('unclear');
    expect(decision.basis).toBe('03');
    expect(decision.diagnostics).toContain('03_market_target_from_delivery');
  });
});

describe('deriveMarket — scope and channel rules', () => {
  it('a seller-wide purchase restriction covers every offer', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'purchase',
        direction: 'restricts',
        scope: 'domain',
        quote: 'Parduodame tik Lenkijoje.',
      }),
    ]);

    expect(decision.status).toBe('other');
  });

  it('a delivery restriction alone is not "other"', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'domain',
        quote: 'Siunčiame tik į Lenkiją.',
      }),
    ]);

    expect(decision.status).toBe('unclear');
    expect(decision.channels.delivery).toBe('closed');
    expect(decision.channels.pickup).toBe('unknown');
  });

  it('an offer-level rule wins over a seller-wide rule for the same channel', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'pickup',
        direction: 'restricts',
        scope: 'domain',
        quote: 'Atsiėmimas galimas tik Varšuvoje.',
      }),
      quote({
        channel: 'pickup',
        direction: 'allows',
        scope: 'offer',
        quote: 'Šią prekę galima atsiimti Vilniuje.',
      }),
    ]);

    expect(decision.status).toBe('target');
    expect(decision.channels.pickup).toBe('open');
    // The seller-wide rule is background for this channel, not evidence.
    expect(decision.evidence).toHaveLength(1);
    expect(decision.evidence[0]?.scope).toBe('offer');
  });

  it('two quotes of the same scope that disagree leave the channel unknown', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'delivery',
        direction: 'allows',
        scope: 'offer',
        quote: 'Pristatome į Lietuvą.',
      }),
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Į Lietuvą nepristatome.',
      }),
    ]);

    expect(decision.status).toBe('unclear');
    expect(decision.channels.delivery).toBe('unknown');
    expect(decision.conflict).toBe(true);
  });

  it('a closed pickup without a purchase rule is unclear, not rejected', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Į Lietuvą nepristatome.',
      }),
      quote({
        channel: 'pickup',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Atsiėmimas galimas tik Varšuvoje.',
      }),
    ]);

    expect(decision.status).toBe('unclear');
  });

  it('evidence about another offer is ignored', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'delivery',
        direction: 'allows',
        scope: 'offer',
        appliesTo: [OTHER_OFFER],
        quote: 'Kitos prekės pristatymas į Lietuvą.',
      }),
    ]);

    expect(decision.status).toBe('unclear');
    expect(decision.resolvedBy).toBe('none');
    expect(decision.evidence).toEqual([]);
  });
});

type TableRow = {
  name: string;
  evidence: MarketEvidence[];
  status: MarketStatus;
  channels: Record<MarketChannel, ChannelState>;
  conflict: boolean;
  /** Expected stored quotes, in the deterministic order deriveMarket returns. */
  used: string[];
};

/**
 * The client's acceptance table. `purchase` is a statement about the whole
 * offer, not a third acquisition channel: its restriction reaches both ways to
 * acquire the offer, while an offer-scoped exception can still open one.
 */
const CLIENT_TABLE: readonly TableRow[] = [
  {
    name: 'an offer sold only in Poland beats a seller-wide EU delivery promise',
    evidence: [
      quote({
        channel: 'purchase',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Prekė parduodama tik Lenkijoje.',
      }),
      quote({
        channel: 'delivery',
        direction: 'allows',
        scope: 'domain',
        quote: 'Pristatome visoje ES.',
      }),
    ],
    status: 'other',
    channels: { delivery: 'closed', pickup: 'closed', purchase: 'closed' },
    conflict: false,
    // The seller-wide promise is superseded by the specific purchase rule.
    used: ['Prekė parduodama tik Lenkijoje.'],
  },
  {
    name: 'an offer sold only in Poland and pickup in Vilnius is an equal-scope contradiction',
    evidence: [
      quote({
        channel: 'purchase',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Prekė parduodama tik Lenkijoje.',
      }),
      quote({
        channel: 'pickup',
        direction: 'allows',
        scope: 'offer',
        quote: 'Atsiėmimas Vilniuje: Ateities g. 33',
      }),
    ],
    status: 'unclear',
    channels: { delivery: 'closed', pickup: 'unknown', purchase: 'closed' },
    conflict: true,
    used: [
      'Atsiėmimas Vilniuje: Ateities g. 33',
      'Prekė parduodama tik Lenkijoje.',
    ],
  },
  {
    name: 'a seller-wide "sold only in Poland" is beaten by an offer-scoped pickup',
    evidence: [
      quote({
        channel: 'purchase',
        direction: 'restricts',
        scope: 'domain',
        quote: 'Parduodame tik Lenkijoje.',
      }),
      quote({
        channel: 'pickup',
        direction: 'allows',
        scope: 'offer',
        quote: 'Atsiėmimas Vilniuje: Ateities g. 33',
      }),
    ],
    status: 'target',
    channels: { delivery: 'closed', pickup: 'open', purchase: 'closed' },
    conflict: false,
    used: [
      'Atsiėmimas Vilniuje: Ateities g. 33',
      'Parduodame tik Lenkijoje.',
    ],
  },
  {
    name: 'excluded 3 m boards stay target when pickup in Vilnius is offered',
    evidence: [
      quote({
        channel: 'delivery',
        direction: 'allows',
        scope: 'domain',
        quote: 'Pristatome visoje Lietuvoje.',
      }),
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'offer',
        quote: '3 m lentų į Lietuvą nepristatome.',
      }),
      quote({
        channel: 'pickup',
        direction: 'allows',
        scope: 'offer',
        quote: 'Atsiėmimas Vilniuje: Ateities g. 33',
      }),
    ],
    status: 'target',
    channels: { delivery: 'closed', pickup: 'open', purchase: 'unknown' },
    conflict: false,
    // The domain delivery promise is background, so it is not stored.
    used: [
      '3 m lentų į Lietuvą nepristatome.',
      'Atsiėmimas Vilniuje: Ateities g. 33',
    ],
  },
  {
    name: 'a seller-wide "we sell in Lithuania" cannot rescue both closed ways',
    evidence: [
      quote({
        channel: 'purchase',
        direction: 'allows',
        scope: 'domain',
        quote: 'Parduodame Lietuvoje.',
      }),
      quote({
        channel: 'delivery',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Šios prekės į Lietuvą nepristatome.',
      }),
      quote({
        channel: 'pickup',
        direction: 'restricts',
        scope: 'offer',
        quote: 'Atsiėmimas galimas tik Varšuvoje.',
      }),
    ],
    status: 'target',
    channels: { delivery: 'closed', pickup: 'closed', purchase: 'open' },
    conflict: false,
    used: [
      'Šios prekės į Lietuvą nepristatome.',
      'Atsiėmimas galimas tik Varšuvoje.',
      'Parduodame Lietuvoje.',
    ],
  },
];

describe('deriveMarket — client acceptance table', () => {
  for (const row of CLIENT_TABLE) {
    it(row.name, () => {
      const decision = deriveMarket(OFFER, row.evidence);

      expect(decision.status).toBe(row.status);
      expect(decision.channels).toEqual(row.channels);
      expect(decision.conflict).toBe(row.conflict);
      expect(decision.resolvedBy).toBe(
        row.used.length > 0 ? 'evidence' : 'none',
      );
      expect(decision.evidence.map((item) => item.quote)).toEqual(row.used);
    });
  }

  it('a seller-wide purchase promise alone is target', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'purchase',
        direction: 'allows',
        scope: 'domain',
        quote: 'Parduodame Lietuvoje.',
      }),
    ]);

    expect(decision.status).toBe('target');
    expect(decision.channels.purchase).toBe('open');
  });

  it('a seller-wide purchase restriction and a seller-wide delivery promise conflict', () => {
    const decision = deriveMarket(OFFER, [
      quote({
        channel: 'purchase',
        direction: 'restricts',
        scope: 'domain',
        quote: 'Parduodame tik Lenkijoje.',
      }),
      quote({
        channel: 'delivery',
        direction: 'allows',
        scope: 'domain',
        quote: 'Pristatome į Lietuvą.',
      }),
    ]);

    expect(decision.status).toBe('unclear');
    expect(decision.channels.delivery).toBe('unknown');
    expect(decision.conflict).toBe(true);
  });
});

describe('deriveMarket — evidence order does not change the verdict', () => {
  const cases = [
    ...CLIENT_TABLE,
    {
      name: 'the seller-wide purchase promise alone',
      evidence: [
        quote({
          channel: 'purchase',
          direction: 'allows',
          scope: 'domain',
          quote: 'Parduodame Lietuvoje.',
        }),
      ],
    },
    {
      name: 'two equal-scope rules that disagree',
      evidence: [
        quote({
          channel: 'purchase',
          direction: 'restricts',
          scope: 'domain',
          quote: 'Parduodame tik Lenkijoje.',
        }),
        quote({
          channel: 'delivery',
          direction: 'allows',
          scope: 'domain',
          quote: 'Pristatome į Lietuvą.',
        }),
      ],
    },
  ];

  for (const testCase of cases) {
    it(`keeps the same decision for every order — ${testCase.name}`, () => {
      const expected = deriveMarket(OFFER, testCase.evidence);

      for (const permutation of permutations(testCase.evidence)) {
        expect(deriveMarket(OFFER, permutation)).toEqual(expected);
      }
    });
  }
});
