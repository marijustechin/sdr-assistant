import type {
  CompanyPrice,
  CompanyProfileStatus,
  CompanyProfileView,
  ProfilingSummaryKey,
  ResearchResultView,
} from '@/entities/research/client';

export const COMPANY_STATUS_LABELS: Record<CompanyProfileStatus, string> = {
  profiled: 'Profiled',
  needs_review: 'Needs review',
  rejected: 'Rejected',
  error: 'Error',
};

/** Direct labels for the stage-04 counts object; no value is derived. */
export const PROFILING_SUMMARY_LABELS: Record<ProfilingSummaryKey, string> = {
  domains: 'Domains',
  reused: 'Reused saved profiles',
  firstCallOnly: 'First-call profiles',
  secondCall: 'Second-call profiles',
  secondCallFailed: 'Failed second calls',
  errors: 'Profile errors',
  newFetches: 'New fetches',
  newLlmCalls: 'New LLM calls',
  newPromptTokens: 'Prompt tokens',
  newCompletionTokens: 'Completion tokens',
};

export function companyStatusTone(
  status: CompanyProfileStatus,
): 'ok' | 'muted' | 'error' {
  if (status === 'profiled') {
    return 'ok';
  }

  return status === 'error' ? 'error' : 'muted';
}

/** Trading name when known, otherwise the domain — never a fabricated name. */
export function companyDisplayName(company: CompanyProfileView): string {
  return company.name ?? company.domain;
}

const UNIT_LABELS: Record<NonNullable<CompanyPrice['unit']>, string> = {
  m2: 'm²',
  m: 'm',
  pc: 'pc',
  pack: 'pack',
};

/** Confirmed PRODUCT.md semantics for the recorded offer verdict. */
export const PRODUCT_MATCH_LABELS: Record<'a' | 'b', string> = {
  a: 'Exact product',
  b: 'Category match',
};

export function productMatchLabel(verdict: 'a' | 'b' | null): string {
  return verdict === null
    ? 'Not recorded'
    : `${PRODUCT_MATCH_LABELS[verdict]} (${verdict})`;
}

export function unitLabel(unit: CompanyPrice['unit']): string {
  return unit === null ? 'Not recorded' : UNIT_LABELS[unit];
}

export function vatLabel(vatIncluded: boolean | null): string {
  if (vatIncluded === true) {
    return 'Included';
  }

  return vatIncluded === false ? 'Excluded' : 'Not recorded';
}

/** Amount plus the recorded `from` qualifier; currency and unit stay separate. */
export function formatPriceAmount(price: CompanyPrice): string {
  const amount = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 2,
  }).format(price.amount);

  return `${price.priceType === 'from' ? 'From ' : ''}${amount}`;
}

/** Formats only what the price record actually contains. */
export function formatPrice(price: CompanyPrice): string {
  const unit = price.unit === null ? '' : `/${UNIT_LABELS[price.unit]}`;
  const money = `${formatPriceAmount(price)}${
    price.currency === null ? '' : ` ${price.currency}`
  }${unit}`;

  const qualifiers: string[] = [];

  if (price.vatIncluded === true) {
    qualifiers.push('incl. VAT');
  } else if (price.vatIncluded === false) {
    qualifiers.push('excl. VAT');
  }

  if (price.variant !== null) {
    qualifiers.push(price.variant);
  }

  return [money, ...qualifiers].join(' · ');
}

export function offersLabel(count: number): string {
  return count === 1 ? '1 offer' : `${count} offers`;
}

export function companiesLabel(count: number): string {
  return count === 1 ? '1 company' : `${count} companies`;
}

/** User-facing explanation of the result state, without invented facts. */
export function resultAvailabilityMessage(result: ResearchResultView): string {
  switch (result.state) {
    case 'profiles':
      return `Company profiles are available for ${companiesLabel(
        result.companies.length,
      )}.`;
    case 'empty':
      return 'The research completed and found no companies. This is a valid empty result, not a missing result.';
    case 'historical':
      return result.completedThrough === null
        ? 'This research completed without persisted company profiles.'
        : `This research completed without persisted company profiles. Its stored completion label is “${result.completedThrough}”.`;
    case 'not-completed':
      return 'This research has not completed. No final result is available yet.';
    case 'unsupported':
      return resultDetailMessage(result);
  }
}

export function resultDetailMessage(result: ResearchResultView): string {
  switch (result.detail) {
    case 'missing-result':
      return 'No result was stored for this completed research.';
    case 'unsupported-version':
      return result.schemaVersion === null
        ? 'The stored result uses an unsupported schema version.'
        : `The stored result uses unsupported schema version ${result.schemaVersion}.`;
    case 'malformed-companies':
      return 'The stored result contains company data that cannot be read.';
    case 'unreadable-profiles':
      return result.unreadableProfiles === 1
        ? 'One company profile was stored, but it could not be read.'
        : `${result.unreadableProfiles} company profiles were stored, but none could be read.`;
    case 'unknown-format':
      return 'The stored result uses an unrecognized format.';
    default:
      return 'No readable result is available for this research.';
  }
}

export function unreadableDataMessage(
  result: ResearchResultView,
): string | null {
  const parts: string[] = [];

  if (result.unreadableProfiles > 0) {
    parts.push(
      result.unreadableProfiles === 1
        ? '1 company profile could not be read and is not shown.'
        : `${result.unreadableProfiles} company profiles could not be read and are not shown.`,
    );
  }

  if (result.unreadableOffers > 0) {
    parts.push(
      result.unreadableOffers === 1
        ? '1 offer record could not be read and is not shown.'
        : `${result.unreadableOffers} offer records could not be read and are not shown.`,
    );
  }

  if (result.unreadablePrices > 0) {
    parts.push(
      result.unreadablePrices === 1
        ? '1 price record could not be read and is not shown.'
        : `${result.unreadablePrices} price records could not be read and are not shown.`,
    );
  }

  return parts.length === 0 ? null : parts.join(' ');
}
