import type {
  ActivityCheck,
  CheckStatus,
  DuplicateCheck,
  ExclusionReason,
  QualificationChecks,
  QualificationDecision,
  QualificationDraft,
  RelevanceCheck,
  SourceCompany,
  WebsiteCheck,
} from './lead-qualification.types.js';

export const EXCLUSION_REASON_PRIORITY: readonly ExclusionReason[] = [
  'DUPLICATE_COMPANY',
  'WEBSITE_UNAVAILABLE',
  'NO_VALID_HTTPS',
  'INACTIVE_BUSINESS',
  'COUNTRY_MISMATCH',
  'COUNTRY_UNCONFIRMED',
  'IRRELEVANT_BUSINESS',
  'EMAIL_NOT_FOUND',
  'INSUFFICIENT_EVIDENCE',
  'PROCESSING_FAILED',
];

const PARKED_PATTERNS = [
  /\bdomain\s+(?:is\s+)?for\s+sale\b/i,
  /\bbuy\s+this\s+domain\b/i,
  /\bthis\s+domain\s+is\s+parked\b/i,
  /\bparked\s+(?:domain|page)\b/i,
  /\bwebsite\s+(?:is\s+)?expired\b/i,
  /\baccount\s+(?:is\s+)?suspended\b/i,
  /\bdefault\s+(?:web\s+)?page\b/i,
  /\bdomain\s+has\s+expired\b/i,
];

const ANNOUNCEMENT_PATTERNS = [
  /\bunder\s+construction\b/i,
  /\bcoming\s+soon\b/i,
];

export function isInactivePage(text: string): boolean {
  return PARKED_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasCommercialAnnouncement(text: string): boolean {
  return ANNOUNCEMENT_PATTERNS.some((pattern) => pattern.test(text));
}

function check(
  status: CheckStatus,
  reason: ExclusionReason | null,
  detail: string | null,
  technicalFailure = false,
) {
  return {
    status,
    reason,
    evidence: [] as QualificationDraft['checks']['website']['evidence'],
    detail,
    technicalFailure,
  };
}

/** Deterministic activity gate. It never turns a valid certificate into proof of trade. */
export function assessActivity(
  website: WebsiteCheck,
  company: SourceCompany,
): ActivityCheck {
  const base = check('NOT_EVALUATED', null, 'Website is not operational.');

  if (website.status !== 'PASS') return base;

  if (isInactivePage(website.bodyText)) {
    return {
      ...check('FAIL', 'INACTIVE_BUSINESS', 'Parked, expired or abandoned website content.'),
      evidence: website.evidence,
    };
  }

  const signals = [
    /\b(?:contact|kontakt|kontaktai|susisiek|telefon|phone|email|e-mail)\b/i,
    /\b(?:shop|store|catalog|catalogue|product|produkt|prek|offer|pricing|price|kaina)\b/i,
    /\b(?:about|company|įmonė|imone|legal|imprint|registracijos|vat)\b/i,
    /\b(?:cart|basket|checkout|order|buy|pirkti)\b/i,
  ].filter((pattern) => pattern.test(website.bodyText)).length;

  if (signals >= 2 && website.bodyText.length >= 120) {
    return {
      ...check('PASS', null, 'Current page has independent commercial signals.'),
      evidence: website.evidence,
    };
  }

  return {
    ...check(
      'UNKNOWN',
      'INSUFFICIENT_EVIDENCE',
      hasCommercialAnnouncement(website.bodyText)
        ? 'Commercial announcement without sufficient current commercial evidence.'
        : 'Website is operational but commercial activity is not yet established.',
    ),
    evidence: website.evidence,
  };
}

/** Deterministic relevance gate. Category-only matches require semantic review. */
export function assessRelevance(company: SourceCompany): RelevanceCheck {
  const offers = company.offers.filter((offer) => offer.sourceUrl !== null);
  const aOffers = offers.filter((offer) => offer.verdict === 'a');
  const bOffers = offers.filter((offer) => offer.verdict === 'b');
  const matchedOfferIds = offers
    .map((offer) => offer.id)
    .filter((id): id is string => id !== null);

  if (aOffers.length > 0) {
    return {
      status: 'PASS',
      reason: null,
      evidence: aOffers.map((offer) => ({
        url: offer.sourceUrl ?? '',
        kind: 'offer' as const,
        quote: null,
        source: 'stage04' as const,
        observedAt: new Date().toISOString(),
      })).filter((evidence) => evidence.url.length > 0),
      detail: 'Source-backed exact-product offer evidence.',
      technicalFailure: false,
      matchedOfferIds,
      aOffers: aOffers.length,
      bOffers: bOffers.length,
      targetMarketOffers: 0,
    };
  }

  if (bOffers.length > 0) {
    return {
      status: 'UNKNOWN',
      reason: 'IRRELEVANT_BUSINESS',
      evidence: bOffers.map((offer) => ({
        url: offer.sourceUrl ?? '',
        kind: 'offer' as const,
        quote: null,
        source: 'stage04' as const,
        observedAt: new Date().toISOString(),
      })).filter((evidence) => evidence.url.length > 0),
      detail: 'Category-only offer match requires semantic review.',
      technicalFailure: false,
      matchedOfferIds,
      aOffers: 0,
      bOffers: bOffers.length,
      targetMarketOffers: 0,
    };
  }

  return {
    status: 'FAIL',
    reason: 'IRRELEVANT_BUSINESS',
    evidence: [],
    detail: 'No source-backed product or category offer evidence.',
    technicalFailure: false,
    matchedOfferIds: [],
    aOffers: 0,
    bOffers: 0,
    targetMarketOffers: 0,
  };
}

export type DecisionResult = {
  decision: QualificationDecision;
  primaryExclusionReason: ExclusionReason | null;
  exclusionReasons: ExclusionReason[];
  technicalFailure: boolean;
};

/**
 * Applies every mandatory gate. There is deliberately no score, weighting or
 * compensating pass: every gate must be PASS for acceptance.
 */
export function decideQualification(checks: QualificationChecks): DecisionResult {
  const values = [
    checks.duplicate,
    checks.website,
    checks.activity,
    checks.geography,
    checks.relevance,
    checks.email,
  ];
  const reasons = [
    ...new Set(
      values
        .filter((value) => value.status !== 'PASS' && value.reason !== null)
        .map((value) => value.reason as ExclusionReason),
    ),
  ].sort(
    (left, right) =>
      EXCLUSION_REASON_PRIORITY.indexOf(left) -
      EXCLUSION_REASON_PRIORITY.indexOf(right),
  );
  const technicalFailure =
    values.some((value) => value.technicalFailure) ||
    reasons.includes('PROCESSING_FAILED');

  if (values.every((value) => value.status === 'PASS')) {
    return {
      decision: 'ACCEPTED',
      primaryExclusionReason: null,
      exclusionReasons: [],
      technicalFailure: false,
    };
  }

  const finalReasons =
    reasons.length > 0 ? reasons : (['INSUFFICIENT_EVIDENCE'] as ExclusionReason[]);

  return {
    decision: 'EXCLUDED',
    primaryExclusionReason: finalReasons[0] ?? 'INSUFFICIENT_EVIDENCE',
    exclusionReasons: finalReasons,
    technicalFailure,
  };
}

function normaliseIdentity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function duplicateKeys(company: SourceCompany): string[] {
  const keys = new Set<string>();
  keys.add(`domain:${company.registrableDomain ?? company.domain}`);

  if (company.vat !== null) {
    const vat = normaliseIdentity(company.vat);
    if (vat.length >= 4) keys.add(`vat:${vat}`);
  }

  if (company.code !== null && company.country !== null) {
    const code = normaliseIdentity(company.code);
    const country = normaliseIdentity(company.country);
    if (code.length >= 3) keys.add(`registration:${country}:${code}`);
  }

  return [...keys];
}

export type DuplicateGroup = {
  key: string;
  companyKeys: string[];
};

/** Groups only high-confidence identity matches; contacts/names alone never merge. */
export function findDuplicateGroups(
  companies: readonly SourceCompany[],
): DuplicateGroup[] {
  const parent = companies.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current] ?? current];
      current = parent[current] ?? current;
    }
    return current;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  const keyToIndex = new Map<string, number>();
  for (let index = 0; index < companies.length; index += 1) {
    for (const key of duplicateKeys(companies[index])) {
      const existing = keyToIndex.get(key);
      if (existing !== undefined) union(existing, index);
      else keyToIndex.set(key, index);
    }
  }

  const groups = new Map<number, SourceCompany[]>();
  for (let index = 0; index < companies.length; index += 1) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(companies[index]);
    groups.set(root, group);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      key: group.map((company) => company.key).sort()[0] ?? group[0].key,
      companyKeys: group.map((company) => company.key).sort(),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function isAcceptedDraft(draft: QualificationDraft): boolean {
  return draft.decision === 'ACCEPTED';
}

export function representativeScore(draft: QualificationDraft): number {
  return (
    (draft.checks.website.status === 'PASS' ? 100 : 0) +
    (draft.checks.email.status === 'PASS' ? 50 : 0) +
    (draft.checks.relevance.status === 'PASS' ? 25 : 0) +
    draft.contacts.emails.length * 5 +
    draft.contacts.phones.length +
    draft.evidenceSources.length
  );
}

export function markDuplicate(
  draft: QualificationDraft,
  canonicalCompanyKey: string,
  matchedOn: string[],
): QualificationDraft {
  const duplicate: DuplicateCheck = {
    status: 'FAIL',
    reason: 'DUPLICATE_COMPANY',
    evidence: [],
    detail: 'Another qualified record is the retained representative.',
    technicalFailure: false,
    canonicalCompanyKey,
    matchedOn,
  };

  return {
    ...draft,
    decision: 'EXCLUDED',
    primaryExclusionReason: 'DUPLICATE_COMPANY',
    exclusionReasons: ['DUPLICATE_COMPANY'],
    checks: {
      ...draft.checks,
      duplicate,
    },
  };
}
