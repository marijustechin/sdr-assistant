import type {
  ChannelState,
  EvidenceScope,
  MarketChannel,
  MarketDecision,
  MarketDirection,
  MarketEvidence,
  MarketFrom03,
  MarketStatus,
} from './company-profiling.types.js';

/**
 * Decides whether one offer can be bought in the target market.
 *
 * The model reports quotes, not conclusions: every quote states a channel, a
 * direction and the scope of the rule. The rules are the client's, in order:
 *
 * 1. A rule about one offer beats a seller-wide rule about the same channel.
 * 2. `delivery` and `pickup` are the ways to acquire the offer. One open way is
 *    enough for `target`, and closing both is `other`.
 * 3. `purchase` is not a third way to acquire the offer. It is a statement
 *    about the whole purchase ("sold only in Poland"), so a restriction applies
 *    to both ways at once. An offer-scoped restriction closes every way that has
 *    no offer-scoped exception; an exception and a restriction of the same
 *    scope contradict each other, which leaves the offer `unclear`.
 * 4. A seller-wide purchase restriction is beaten by an offer-scoped delivery
 *    or pickup exception: the specific offer can still be acquired that way.
 *    The same relation works in reverse: an offer-scoped closure of both ways
 *    beats a seller-wide purchase promise, so the promise never yields `target`.
 * 5. No quote means `unclear`. A stage-03 `target` stays in `marketFrom03` and
 *    is never promoted to a confirmed market by this function.
 *
 * The returned evidence holds only the quotes that shaped the decision. A
 * quote hidden by a more specific rule of the same channel is background and
 * is not stored, and the array is ordered deterministically so the same
 * evidence always produces the same saved decision.
 */
export function deriveMarket(
  offerId: string,
  evidence: readonly MarketEvidence[],
  marketFrom03?: MarketFrom03,
): MarketDecision {
  const relevant = evidence.filter((item) => item.appliesTo.includes(offerId));

  const purchase = decideChannel(relevant, 'purchase');
  const pickup = applyPurchase(decideChannel(relevant, 'pickup'), purchase);
  // Delivery remains visible in diagnostics but never establishes a market.
  const delivery = applyPurchase(decideChannel(relevant, 'delivery'), purchase);

  const channels: Record<MarketChannel, ChannelState> = {
    delivery: delivery.state,
    pickup: pickup.state,
    purchase: purchase.state,
  };
  const conflict = purchase.conflict || pickup.conflict || delivery.conflict;

  const used = orderEvidence([
    ...delivery.evidence,
    ...pickup.evidence,
    ...purchase.evidence,
  ]);
  const resolvedBy = used.length > 0 ? 'evidence' : 'none';

  let status: MarketStatus;

  if (pickup.state === 'open' || purchase.state === 'open') {
    status = 'target';
  } else if (conflict) {
    status = 'unclear';
  } else if (purchase.state === 'closed') {
    status = 'other';
  } else {
    status = 'unclear';
  }

  if (!marketFrom03) {
    return result(
      status,
      used,
      channels,
      conflict,
      resolvedBy,
      status === 'unclear' ? 'none' : '04',
    );
  }

  if (marketFrom03.status === 'other') {
    return result('other', used, channels, conflict, resolvedBy, '03', [
      '03_market_other_preserved',
    ]);
  }

  if (marketFrom03.status === 'target') {
    // A quote from 03 is preserved as its estimate, but only evidence found
    // while profiling can turn it into a confirmed target.
    if (status === 'target') {
      return result('target', used, channels, conflict, resolvedBy, '04', [
        '04_market_target_confirmed',
      ]);
    }

    const onlyDelivery =
      relevant.length > 0 &&
      relevant.every((item) => item.channel === 'delivery');

    return result('unclear', used, channels, conflict, resolvedBy, '03', [
      onlyDelivery
        ? '03_market_target_from_delivery'
        : marketFrom03.quote
          ? '03_market_target_unverified'
          : '03_market_basis_missing',
    ]);
  }

  return result(
    status,
    used,
    channels,
    conflict,
    resolvedBy,
    status === 'unclear' ? 'none' : '04',
  );
}

type ChannelDecision = {
  state: ChannelState;
  /** The scope that supplied the rule; `null` when nothing applies. */
  scope: EvidenceScope | null;
  evidence: MarketEvidence[];
  conflict: boolean;
};

/**
 * Decides one channel on its own evidence.
 *
 * Only the most specific scope of that channel is read: when the page states a
 * rule for the offer itself, the seller-wide rule for the same channel is
 * background, not a contradiction. Two quotes of the same scope that disagree
 * leave the channel unknown instead of picking a winner.
 */
function decideChannel(
  relevant: readonly MarketEvidence[],
  channel: MarketChannel,
): ChannelDecision {
  const forChannel = relevant.filter((item) => item.channel === channel);

  if (forChannel.length === 0) {
    return { state: 'unknown', scope: null, evidence: [], conflict: false };
  }

  const offerScoped = forChannel.filter((item) => item.scope === 'offer');
  const scoped = offerScoped.length > 0 ? offerScoped : forChannel;
  const scope: EvidenceScope = offerScoped.length > 0 ? 'offer' : 'domain';

  const allows = scoped.filter((item) => item.direction === 'allows');
  const restricts = scoped.filter((item) => item.direction === 'restricts');

  if (allows.length > 0 && restricts.length > 0) {
    return { state: 'unknown', scope, evidence: [...scoped], conflict: true };
  }

  return {
    state: allows.length > 0 ? 'open' : 'closed',
    scope,
    evidence: [...scoped],
    conflict: false,
  };
}

/**
 * Applies a whole-offer purchase restriction to one way of acquiring it.
 *
 * A seller-wide restriction yields to an offer-scoped exception. An
 * offer-scoped restriction closes every way without an offer-scoped exception,
 * and meets an offer-scoped exception as an equal-scope contradiction. An
 * open purchase rule never opens a way by itself: it is an availability claim,
 * not proof of delivery or pickup.
 */
function applyPurchase(
  own: ChannelDecision,
  purchase: ChannelDecision,
): ChannelDecision {
  if (purchase.state !== 'closed') return own;

  if (purchase.scope === 'offer') {
    if (own.scope === 'offer') {
      const exception = own.evidence.some(
        (item) => item.direction === 'allows',
      );

      if (exception) {
        return {
          state: 'unknown',
          scope: 'offer',
          evidence: unique([...own.evidence, ...purchase.evidence]),
          conflict: true,
        };
      }

      return {
        state: 'closed',
        scope: 'offer',
        evidence: unique([...own.evidence, ...purchase.evidence]),
        conflict: false,
      };
    }

    // The purchase restriction is more specific than any seller-wide rule
    // about delivery or pickup, so it closes the way and the general rule is
    // background.
    return {
      state: 'closed',
      scope: 'offer',
      evidence: [...purchase.evidence],
      conflict: false,
    };
  }

  // A seller-wide purchase restriction is background for a way that has its
  // own offer-scoped rule.
  if (own.scope === 'offer') return own;

  if (own.state === 'open') {
    // Two seller-wide statements: "we sell only in Poland" and "we deliver to
    // Lithuania". Neither scope is more specific, so the way stays unknown.
    return {
      state: 'unknown',
      scope: 'domain',
      evidence: unique([...own.evidence, ...purchase.evidence]),
      conflict: true,
    };
  }

  if (own.conflict) {
    return {
      ...own,
      evidence: unique([...own.evidence, ...purchase.evidence]),
    };
  }

  return {
    state: 'closed',
    scope: 'domain',
    evidence: unique([...own.evidence, ...purchase.evidence]),
    conflict: false,
  };
}

function unique(evidence: readonly MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<MarketEvidence>();
  const kept: MarketEvidence[] = [];

  for (const item of evidence) {
    if (seen.has(item)) continue;
    seen.add(item);
    kept.push(item);
  }

  return kept;
}

const CHANNEL_ORDER: Record<MarketChannel, number> = {
  delivery: 0,
  pickup: 1,
  purchase: 2,
};
const DIRECTION_ORDER: Record<MarketDirection, number> = {
  allows: 0,
  restricts: 1,
};
const SCOPE_ORDER: Record<EvidenceScope, number> = { offer: 0, domain: 1 };

function orderEvidence(evidence: readonly MarketEvidence[]): MarketEvidence[] {
  return unique(evidence).sort(
    (a, b) =>
      CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel] ||
      DIRECTION_ORDER[a.direction] - DIRECTION_ORDER[b.direction] ||
      SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
      a.quote.localeCompare(b.quote) ||
      a.sourceUrl.localeCompare(b.sourceUrl),
  );
}

function result(
  status: MarketStatus,
  evidence: MarketEvidence[],
  channels: Record<MarketChannel, ChannelState>,
  conflict: boolean,
  resolvedBy: MarketDecision['resolvedBy'],
  basis: '03' | '04' | 'none',
  diagnostics: string[] = [],
): MarketDecision {
  return { status, evidence, channels, conflict, resolvedBy, basis, diagnostics };
}
