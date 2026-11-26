import { z } from 'zod';

import type { ResearchResponse } from './schema';

/**
 * Typed presentation model for the persisted research result.
 *
 * The API returns `research.result` verbatim because historical rows keep seven
 * different unversioned envelopes plus the versioned `schemaVersion: 1` contract
 * (see docs/system/research.md §7 and SDR-006/SDR-006A). This module validates only
 * the fields the workspace presents, keeps dynamic trait keys and optional data, and
 * describes every unsupported or unreadable shape instead of guessing.
 *
 * Rules:
 * - a missing `companies` field is never treated as `companies: []`;
 * - a present empty `companies` array is a genuine completed result with zero companies;
 * - a malformed individual profile, offer or price is counted and skipped, not fatal;
 * - no value is invented for a field the persisted result does not contain.
 */

export const companyProfileStatusSchema = z.enum([
  'profiled',
  'needs_review',
  'rejected',
  'error',
]);

export type CompanyProfileStatus = z.infer<typeof companyProfileStatusSchema>;

export const researchResultAvailabilitySchema = z.enum([
  /** A readable, non-empty company profile list. */
  'profiles',
  /** A present `companies: []` — a valid completed result. */
  'empty',
  /** A completed historical result without a `companies` field. */
  'historical',
  /** The research has not reached a completed final result. */
  'not-completed',
  /** A completed result that cannot be interpreted. */
  'unsupported',
]);

export type ResearchResultAvailability = z.infer<
  typeof researchResultAvailabilitySchema
>;

export const researchResultDetailSchema = z.enum([
  'missing-result',
  'unknown-format',
  'unsupported-version',
  'malformed-companies',
  'unreadable-profiles',
]);

export type ResearchResultDetail = z.infer<typeof researchResultDetailSchema>;

export type CompanyEmail = {
  value: string;
  label: 'sales' | 'general' | null;
  sourceUrl: string | null;
};

export type CompanyPhone = {
  value: string;
  normalised: string | null;
  label: 'sales' | 'general' | null;
  sourceUrl: string | null;
};

export type CompanyProfileError = {
  code: string;
  message: string;
};

export type CompanyPrice = {
  amount: number;
  currency: string | null;
  unit: 'm2' | 'm' | 'pc' | 'pack' | null;
  vatIncluded: boolean | null;
  priceType: 'exact' | 'from' | null;
  variant: string | null;
  quote: string | null;
  sourceUrl: string | null;
};

export type MarketFrom03View =
  | { kind: 'text'; text: string }
  | {
      kind: 'details';
      status: string | null;
      note: string | null;
      quote: string | null;
      sourceUrl: string | null;
    };

export type MarketEvidenceView = {
  channel: 'delivery' | 'pickup' | 'purchase';
  direction: 'allows' | 'restricts';
  scope: 'domain' | 'offer';
  appliesTo: string[];
  quote: string | null;
  sourceUrl: string | null;
};

export type MarketView = {
  status: 'target' | 'other' | 'unclear';
  resolvedBy: 'evidence' | 'none' | null;
  basis: '03' | '04' | 'none' | null;
  conflict: boolean | null;
  channels: Array<{
    channel: 'delivery' | 'pickup' | 'purchase';
    /** Shown as recorded; unknown historical values are not reclassified. */
    state: string;
  }>;
  evidence: MarketEvidenceView[];
};

export type CompanyOfferView = {
  /** Stable local key; offer ids may repeat across profiles. */
  key: string;
  id: string | null;
  item: string;
  /** Shown exactly as recorded: the meaning of `a`/`b` is not interpreted here. */
  verdict: 'a' | 'b' | null;
  /** Dynamic, study-specific trait keys, preserved in their stored order. */
  traits: Array<{ key: string; value: string }>;
  pageIds: string[];
  sourceUrl: string | null;
  marketFrom03: MarketFrom03View | null;
  market: MarketView | null;
  prices: CompanyPrice[];
};

export type CompanyProfileView = {
  key: string;
  domain: string;
  registrableDomain: string | null;
  status: CompanyProfileStatus;
  error: CompanyProfileError | null;
  name: string | null;
  legalName: string | null;
  code: string | null;
  vat: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contactFormUrl: string | null;
  emails: CompanyEmail[];
  phones: CompanyPhone[];
  sources: string[];
  offers: CompanyOfferView[];
  unreadableOffers: number;
  unreadablePrices: number;
};

export type ProfilingSummaryKey =
  | 'domains'
  | 'reused'
  | 'firstCallOnly'
  | 'secondCall'
  | 'secondCallFailed'
  | 'errors'
  | 'newFetches'
  | 'newLlmCalls'
  | 'newPromptTokens'
  | 'newCompletionTokens';

export type ProfilingSummary = Partial<Record<ProfilingSummaryKey, number>>;

export const PROFILING_SUMMARY_KEYS: readonly ProfilingSummaryKey[] = [
  'domains',
  'reused',
  'firstCallOnly',
  'secondCall',
  'secondCallFailed',
  'errors',
  'newFetches',
  'newLlmCalls',
  'newPromptTokens',
  'newCompletionTokens',
];

export type ResearchResultView = {
  state: ResearchResultAvailability;
  detail: ResearchResultDetail | null;
  schemaVersion: number | null;
  completedThrough: string | null;
  resultsPerQuery: number | null;
  summary: ProfilingSummary | null;
  companies: CompanyProfileView[];
  unreadableProfiles: number;
  unreadableOffers: number;
  unreadablePrices: number;
  /** A historical string result, shown as stored text instead of raw JSON. */
  legacyNote: string | null;
};

export type ResearchListItem = {
  id: string;
  productId: string;
  productName: string | null;
  country: string;
  status: ResearchResponse['status'];
  createdAt: string;
  updatedAt: string;
  resultState: ResearchResultAvailability;
  resultDetail: ResearchResultDetail | null;
  completedThrough: string | null;
  schemaVersion: number | null;
  companyCount: number | null;
  offerCount: number | null;
  unreadableProfiles: number;
};

export const RESULT_AVAILABILITY_LABELS: Record<
  ResearchResultAvailability,
  string
> = {
  profiles: 'Company profiles available',
  empty: 'Completed — no companies found',
  historical: 'Completed — profiles not persisted',
  'not-completed': 'Research not completed',
  unsupported: 'Result unavailable',
};

const nullableText = z.string().nullable().optional();

const contactEmailSchema = z.object({
  value: z.string().min(1),
  label: z.enum(['sales', 'general']).nullable().optional(),
  sourceUrl: z.string().optional(),
});

const contactPhoneSchema = z.object({
  value: z.string().min(1),
  normalised: z.string().nullable().optional(),
  label: z.enum(['sales', 'general']).nullable().optional(),
  sourceUrl: z.string().optional(),
});

const companyIdentitySchema = z.object({
  name: nullableText,
  legalName: nullableText,
  code: nullableText,
  vat: nullableText,
  address: nullableText,
  city: nullableText,
  country: nullableText,
  emails: z.array(contactEmailSchema).optional(),
  phones: z.array(contactPhoneSchema).optional(),
  contactFormUrl: z.string().nullable().optional(),
  sources: z.array(z.string()).optional(),
});

const priceSchema = z.object({
  amount: z.number(),
  currency: z.string().nullable().optional(),
  unit: z.enum(['m2', 'm', 'pc', 'pack']).nullable().optional(),
  vatIncluded: z.boolean().nullable().optional(),
  priceType: z.enum(['exact', 'from']).optional(),
  variant: z.string().nullable().optional(),
  quote: z.string().optional(),
  sourceUrl: z.string().optional(),
});

const marketEvidenceSchema = z.object({
  channel: z.enum(['delivery', 'pickup', 'purchase']),
  direction: z.enum(['allows', 'restricts']),
  scope: z.enum(['domain', 'offer']),
  appliesTo: z.array(z.string()).optional(),
  quote: z.string().optional(),
  sourceUrl: z.string().optional(),
});

const marketSchema = z.object({
  status: z.enum(['target', 'other', 'unclear']),
  resolvedBy: z.enum(['evidence', 'none']).optional(),
  basis: z.enum(['03', '04', 'none']).optional(),
  evidence: z.array(marketEvidenceSchema).optional(),
  channels: z.record(z.string(), z.string()).optional(),
  conflict: z.boolean().optional(),
});

const marketFrom03Schema = z.object({
  status: z.string().optional(),
  note: z.string().nullable().optional(),
  sourceUrl: z.string().optional(),
  quote: z.string().nullable().optional(),
});

const offerSchema = z.object({
  id: z.string().optional(),
  item: z.string().min(1),
  verdict: z.enum(['a', 'b']).nullable().optional(),
  traits: z.record(z.string(), z.string()).optional(),
  pageIds: z.array(z.string()).optional(),
  sourceUrl: z.string().optional(),
  marketFrom03: z.union([marketFrom03Schema, z.string()]).nullable().optional(),
  market: marketSchema.nullable().optional(),
  prices: z.array(z.unknown()).optional(),
});

const companyProfileSchema = z.object({
  domain: z.string().min(1),
  registrableDomain: z.string().nullable().optional(),
  status: companyProfileStatusSchema,
  error: z
    .object({
      code: z.string().min(1),
      message: z.string(),
    })
    .optional(),
  company: companyIdentitySchema,
  offers: z.array(z.unknown()).optional(),
});

/** Narrowing helper; avoids `any` and unchecked casts. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function parseSummary(value: unknown): ProfilingSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const summary: ProfilingSummary = {};
  let count = 0;

  for (const key of PROFILING_SUMMARY_KEYS) {
    const number = toFiniteNumber(value[key]);

    if (number !== null) {
      summary[key] = number;
      count += 1;
    }
  }

  return count === 0 ? null : summary;
}

function normaliseMarketFrom03(value: unknown): MarketFrom03View | null {
  if (typeof value === 'string') {
    return { kind: 'text', text: value };
  }

  if (!isRecord(value)) {
    return null;
  }

  const parsed = marketFrom03Schema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return {
    kind: 'details',
    status: textOrNull(parsed.data.status),
    note: textOrNull(parsed.data.note),
    quote: textOrNull(parsed.data.quote),
    sourceUrl: textOrNull(parsed.data.sourceUrl),
  };
}

function normaliseMarket(value: unknown): MarketView | null {
  if (!isRecord(value)) {
    return null;
  }

  const parsed = marketSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const channels = parsed.data.channels;
  const channelViews: MarketView['channels'] = [];

  for (const channel of ['delivery', 'pickup', 'purchase'] as const) {
    const state = channels?.[channel];

    if (typeof state === 'string') {
      channelViews.push({ channel, state });
    }
  }

  return {
    status: parsed.data.status,
    resolvedBy: parsed.data.resolvedBy ?? null,
    basis: parsed.data.basis ?? null,
    conflict: parsed.data.conflict ?? null,
    channels: channelViews,
    evidence: (parsed.data.evidence ?? []).map((entry) => ({
      channel: entry.channel,
      direction: entry.direction,
      scope: entry.scope,
      appliesTo: entry.appliesTo ?? [],
      quote: textOrNull(entry.quote),
      sourceUrl: textOrNull(entry.sourceUrl),
    })),
  };
}

function parsePrices(value: unknown[] | undefined): {
  prices: CompanyPrice[];
  unreadable: number;
} {
  if (value === undefined) {
    return { prices: [], unreadable: 0 };
  }

  const prices: CompanyPrice[] = [];
  let unreadable = 0;

  for (const entry of value) {
    const parsed = priceSchema.safeParse(entry);

    if (!parsed.success) {
      unreadable += 1;
      continue;
    }

    prices.push({
      amount: parsed.data.amount,
      currency: textOrNull(parsed.data.currency),
      unit: parsed.data.unit ?? null,
      vatIncluded: parsed.data.vatIncluded ?? null,
      priceType: parsed.data.priceType ?? null,
      variant: textOrNull(parsed.data.variant),
      quote: textOrNull(parsed.data.quote),
      sourceUrl: textOrNull(parsed.data.sourceUrl),
    });
  }

  return { prices, unreadable };
}

function buildCompanyProfile(
  profile: z.infer<typeof companyProfileSchema>,
  index: number,
): {
  view: CompanyProfileView;
  unreadableOffers: number;
  unreadablePrices: number;
} {
  const key = `${profile.domain}#${index}`;
  const offers: CompanyOfferView[] = [];
  let unreadableOffers = 0;
  let unreadablePrices = 0;

  for (const [offerIndex, rawOffer] of (profile.offers ?? []).entries()) {
    const parsed = offerSchema.safeParse(rawOffer);

    if (!parsed.success) {
      unreadableOffers += 1;
      continue;
    }

    const priceResult = parsePrices(parsed.data.prices);
    unreadablePrices += priceResult.unreadable;

    offers.push({
      key: `${key}#offer-${offerIndex}`,
      id: textOrNull(parsed.data.id),
      item: parsed.data.item,
      verdict: parsed.data.verdict ?? null,
      traits: Object.entries(parsed.data.traits ?? {}).map(
        ([trait, value]) => ({
          key: trait,
          value,
        }),
      ),
      pageIds: parsed.data.pageIds ?? [],
      sourceUrl: textOrNull(parsed.data.sourceUrl),
      marketFrom03: normaliseMarketFrom03(parsed.data.marketFrom03),
      market: normaliseMarket(parsed.data.market),
      prices: priceResult.prices,
    });
  }

  const company = profile.company;

  return {
    view: {
      key,
      domain: profile.domain,
      registrableDomain: textOrNull(profile.registrableDomain),
      status: profile.status,
      error:
        profile.error === undefined
          ? null
          : { code: profile.error.code, message: profile.error.message },
      name: textOrNull(company.name),
      legalName: textOrNull(company.legalName),
      code: textOrNull(company.code),
      vat: textOrNull(company.vat),
      address: textOrNull(company.address),
      city: textOrNull(company.city),
      country: textOrNull(company.country),
      contactFormUrl: textOrNull(company.contactFormUrl),
      emails: (company.emails ?? []).map((email) => ({
        value: email.value,
        label: email.label ?? null,
        sourceUrl: textOrNull(email.sourceUrl),
      })),
      phones: (company.phones ?? []).map((phone) => ({
        value: phone.value,
        normalised: textOrNull(phone.normalised),
        label: phone.label ?? null,
        sourceUrl: textOrNull(phone.sourceUrl),
      })),
      sources: (company.sources ?? []).filter(
        (source) => typeof source === 'string' && source.trim() !== '',
      ),
      offers,
      unreadableOffers,
      unreadablePrices,
    },
    unreadableOffers,
    unreadablePrices,
  };
}

type Metadata = Pick<
  ResearchResultView,
  'schemaVersion' | 'completedThrough' | 'resultsPerQuery' | 'summary'
>;

function emptyMetadata(): Metadata {
  return {
    schemaVersion: null,
    completedThrough: null,
    resultsPerQuery: null,
    summary: null,
  };
}

function unavailableResult(
  state: 'not-completed' | 'unsupported',
  detail: ResearchResultDetail | null,
  metadata: Metadata = emptyMetadata(),
): ResearchResultView {
  return {
    state,
    detail,
    ...metadata,
    companies: [],
    unreadableProfiles: 0,
    unreadableOffers: 0,
    unreadablePrices: 0,
    legacyNote: null,
  };
}

function parseCompletedResult(
  result: unknown,
  metadata: Metadata,
): ResearchResultView {
  if (result === null || result === undefined) {
    return unavailableResult('unsupported', 'missing-result', metadata);
  }

  if (typeof result === 'string') {
    return {
      state: 'historical',
      detail: null,
      ...metadata,
      companies: [],
      unreadableProfiles: 0,
      unreadableOffers: 0,
      unreadablePrices: 0,
      legacyNote: result,
    };
  }

  if (!isRecord(result)) {
    return unavailableResult('unsupported', 'unknown-format', metadata);
  }

  const hasSchemaVersion = Object.hasOwn(result, 'schemaVersion');
  const schemaVersion = toFiniteNumber(result.schemaVersion);

  if (hasSchemaVersion && schemaVersion !== 1) {
    return unavailableResult('unsupported', 'unsupported-version', {
      ...metadata,
      schemaVersion,
    });
  }

  const hasCompanies = Object.hasOwn(result, 'companies');
  const companiesValue = result.companies;

  if (hasCompanies && !Array.isArray(companiesValue)) {
    return unavailableResult('unsupported', 'malformed-companies', metadata);
  }

  if (Array.isArray(companiesValue)) {
    const rawCompanies: readonly unknown[] = companiesValue;

    if (rawCompanies.length === 0) {
      return {
        state: 'empty',
        detail: null,
        ...metadata,
        companies: [],
        unreadableProfiles: 0,
        unreadableOffers: 0,
        unreadablePrices: 0,
        legacyNote: null,
      };
    }

    const companies: CompanyProfileView[] = [];
    let unreadableProfiles = 0;
    let unreadableOffers = 0;
    let unreadablePrices = 0;

    for (const [index, entry] of rawCompanies.entries()) {
      const parsed = companyProfileSchema.safeParse(entry);

      if (!parsed.success) {
        unreadableProfiles += 1;
        continue;
      }

      const built = buildCompanyProfile(parsed.data, index);
      companies.push(built.view);
      unreadableOffers += built.unreadableOffers;
      unreadablePrices += built.unreadablePrices;
    }

    if (companies.length === 0) {
      return {
        ...unavailableResult('unsupported', 'unreadable-profiles', metadata),
        unreadableProfiles,
      };
    }

    return {
      state: 'profiles',
      detail: null,
      ...metadata,
      companies,
      unreadableProfiles,
      unreadableOffers,
      unreadablePrices,
      legacyNote: null,
    };
  }

  if (schemaVersion === 1) {
    return unavailableResult('unsupported', 'malformed-companies', metadata);
  }

  if (metadata.completedThrough !== null || metadata.resultsPerQuery !== null) {
    return {
      state: 'historical',
      detail: null,
      ...metadata,
      companies: [],
      unreadableProfiles: 0,
      unreadableOffers: 0,
      unreadablePrices: 0,
      legacyNote: null,
    };
  }

  return unavailableResult('unsupported', 'unknown-format', metadata);
}

/**
 * Parses the persisted research result into the typed presentation model.
 *
 * Never throws: any unexpected failure is reported as an unsupported result.
 */
export function parseResearchResult(
  research: Pick<ResearchResponse, 'status' | 'result'>,
): ResearchResultView {
  try {
    if (research.status !== 'COMPLETED') {
      return unavailableResult('not-completed', null);
    }

    const result = research.result;
    const metadata: Metadata = {
      schemaVersion: null,
      completedThrough: null,
      resultsPerQuery: null,
      summary: null,
    };

    if (isRecord(result)) {
      metadata.schemaVersion = toFiniteNumber(result.schemaVersion);
      metadata.completedThrough = textOrNull(
        typeof result.completedThrough === 'string'
          ? result.completedThrough
          : null,
      );
      metadata.resultsPerQuery = toFiniteNumber(result.resultsPerQuery);
      metadata.summary = parseSummary(result.summary);
    }

    return parseCompletedResult(result, metadata);
  } catch {
    return unavailableResult('unsupported', 'unknown-format');
  }
}

/** Compact, serialisable row used by the research list. */
export function toResearchListItem(
  research: ResearchResponse,
  productName: string | null,
): ResearchListItem {
  const parsed = parseResearchResult(research);
  const counted = parsed.state === 'profiles' || parsed.state === 'empty';

  return {
    id: research.id,
    productId: research.productId,
    productName,
    country: research.country,
    status: research.status,
    createdAt: research.createdAt,
    updatedAt: research.updatedAt,
    resultState: parsed.state,
    resultDetail: parsed.detail,
    completedThrough: parsed.completedThrough,
    schemaVersion: parsed.schemaVersion,
    companyCount: counted ? parsed.companies.length : null,
    offerCount: counted
      ? parsed.companies.reduce(
          (total, company) => total + company.offers.length,
          0,
        )
      : null,
    unreadableProfiles: parsed.unreadableProfiles,
  };
}
