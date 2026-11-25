/**
 * Stage 04 market model.
 *
 * The market status is not a value the model fills in: it is derived from
 * quoted evidence. Every quote constrains one channel — delivery, pickup or the
 * purchase as a whole — and carries the scope of the rule it states. A rule
 * about one offer wins over a seller-wide rule for the same channel. Delivery
 * and pickup are the ways to acquire the offer; `purchase` is a statement about
 * the whole purchase, so a purchase restriction constrains both ways at once.
 */

export type MarketChannel = 'delivery' | 'pickup' | 'purchase';

export type MarketDirection = 'allows' | 'restricts';

/** Whether the quoted rule covers the whole seller or one offer. */
export type EvidenceScope = 'domain' | 'offer';

export type MarketStatus = 'target' | 'other' | 'unclear';

/**
 * The stage-03 market basis, preserved verbatim. `note` may be a model summary;
 * `quote` is set only when the note was found in the source page text.
 */
export type MarketFrom03 = {
  status: MarketStatus;
  note: string | null;
  sourceUrl: string;
  quote: string | null;
};

export type ChannelState = 'open' | 'closed' | 'unknown';

/** One verbatim quote about how (or whether) an offer can be bought. */
export type MarketEvidence = {
  /** Which buying channel the quote constrains. */
  channel: MarketChannel;
  direction: MarketDirection;
  scope: EvidenceScope;
  /** Offers the rule covers; never empty. */
  appliesTo: string[];
  /** Verbatim from the supplied page text. */
  quote: string;
  sourceUrl: string;
};

export type MarketDecision = {
  status: MarketStatus;
  /** `none` only when no evidence at all was supplied for this offer. */
  resolvedBy: 'evidence' | 'none';
  /** Which source supplied the final status: stage 03, stage 04, or neither. */
  basis?: '03' | '04' | 'none';
  diagnostics?: string[];
  /**
   * Only the quotes that shaped the decision, in deterministic channel order.
   * A rule hidden by a more specific rule for the same channel is not stored.
   */
  evidence: MarketEvidence[];
  channels: Record<MarketChannel, ChannelState>;
  /**
   * Two rules of the same scope contradict each other — directly on one
   * channel, or between the whole-offer purchase rule and a channel rule.
   */
  conflict: boolean;
};

export type CompanyProfileStatus =
  | 'profiled'
  | 'needs_review'
  | 'rejected'
  | 'error';

export type CompanyProfileError = {
  code: 'fetch_failed' | 'llm_failed' | 'schema_invalid' | 'no_sources';
  message: string;
};

export type CompanyProfilePrice = {
  amount: number;
  currency: string | null;
  unit: 'm2' | 'm' | 'pc' | 'pack' | null;
  vatIncluded: boolean | null;
  priceType: 'exact' | 'from';
  variant: string | null;
  quote: string;
  sourceUrl: string;
};

export type CompanyProfileOffer = {
  id: string;
  item: string;
  /** Inherited from stage 03, unchanged. */
  verdict: 'a' | 'b';
  traits: Record<string, 'confirmed' | 'differs' | 'unknown'>;
  pageIds: string[];
  /** The stage 03 page URL this offer came from. */
  sourceUrl: string;
  marketFrom03: MarketFrom03;
  market: MarketDecision;
  prices: CompanyProfilePrice[];
};

export type CompanyProfileCompany = {
  name: string | null;
  legalName: string | null;
  code: string | null;
  vat: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  emails: Array<{
    value: string;
    label: 'sales' | 'general' | null;
    sourceUrl: string;
  }>;
  phones: Array<{
    value: string;
    normalised: string | null;
    label: 'sales' | 'general' | null;
    sourceUrl: string;
  }>;
  contactFormUrl: string | null;
  /** Every supplied URL that contributed to the profile. */
  sources: string[];
};

export type DomainUsage = {
  llmCalls: number;
  promptTokens: number | null;
  completionTokens: number | null;
  /** Extra gap pages fetched beyond the homepage. */
  fetches: number;
  fetchCredits: number | null;
  /** Wall-clock from 04.1 start to profile; null when it was not measured. */
  durationMs: number | null;
};

export type CompanyProfile = {
  domain: string;
  registrableDomain: string;
  status: CompanyProfileStatus;
  error?: CompanyProfileError;
  company: CompanyProfileCompany;
  offers: CompanyProfileOffer[];
  usage: DomainUsage;
};
