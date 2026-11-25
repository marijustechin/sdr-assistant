import type { FirstCallResult, FirstCallUsage } from './company-profiling.first-call.js';
import type {
  CompanyProfile,
  CompanyProfileCompany,
  CompanyProfileOffer,
  CompanyProfilePrice,
  CompanyProfileStatus,
  DomainUsage,
} from './company-profiling.types.js';

export type BuildProfileOptions = {
  /** Both call usages; `after.usage` is the second call only. */
  usage?: {
    first: FirstCallUsage | null;
    second: FirstCallUsage | null;
  };
  /** Extra gap pages fetched for this domain (homepage excluded). */
  fetches?: number;
  fetchCredits?: number | null;
  durationMs?: number | null;
  /**
   * Saved first-call result. Used only to restore a price relation lost by the
   * earlier cross-offer dedupe in 04.3; both sides are already validated.
   */
  previous?: FirstCallResult;
};

export type CompanyProfileSummary = {
  domain: string;
  registrableDomain: string;
  status: CompanyProfileStatus;
  legal: {
    name: string | null;
    legalName: string | null;
    code: string | null;
    vat: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  };
  offers: Array<{
    id: string;
    item: string;
    verdict: 'a' | 'b';
    marketStatus: CompanyProfile['offers'][number]['market']['status'];
    pageId: string;
    priceCount: number;
  }>;
  /** One entry per distinct price quote, with every offer that uses it. */
  prices: Array<CompanyProfilePrice & { offerIds: string[] }>;
  emails: string[];
  phones: string[];
  contactFormUrl: string | null;
  sources: string[];
  usage: DomainUsage;
};

/**
 * Builds the final profile from the merged 04.3 result. Pure: no fetch, no LLM.
 *
 * Prices are kept per offer; the same catalogue quote can back both the product
 * page and the catalogue entry. `summariseCompanyProfile()` is the place where
 * that quote is shown once for the company.
 */
export function buildCompanyProfile(
  after: FirstCallResult,
  options: BuildProfileOptions = {},
): CompanyProfile {
  const previousPrices = new Map(
    (options.previous?.offers ?? []).map((offer) => [offer.id, offer.prices]),
  );

  const offers: CompanyProfileOffer[] = after.offers.map((offer) => {
    const prices: CompanyProfilePrice[] = [...offer.prices];

    for (const price of previousPrices.get(offer.id) ?? []) {
      if (!prices.some((existing) => samePrice(existing, price))) {
        prices.push({ ...price });
      }
    }

    return {
      id: offer.id,
      item: offer.item,
      verdict: offer.verdict,
      traits: { ...offer.traits },
      pageIds: [offer.id],
      sourceUrl: offer.sourceUrl,
      marketFrom03: offer.marketFrom03,
      market: offer.market,
      prices,
    };
  });

  const status = deriveCompanyProfileStatus(after.company.name, offers);

  const firstUsage = options.usage ? options.usage.first : null;
  const secondUsage = options.usage ? options.usage.second : after.usage;
  const usage: DomainUsage = {
    llmCalls: (firstUsage ? 1 : 0) + (secondUsage ? 1 : 0),
    promptTokens: sumNullable(
      firstUsage?.promptTokens ?? null,
      secondUsage?.promptTokens ?? null,
    ),
    completionTokens: sumNullable(
      firstUsage?.completionTokens ?? null,
      secondUsage?.completionTokens ?? null,
    ),
    fetches: options.fetches ?? 0,
    fetchCredits: options.fetchCredits ?? null,
    durationMs: options.durationMs ?? null,
  };

  const company: CompanyProfileCompany = {
    name: after.company.name,
    legalName: after.company.legalName,
    code: after.company.code,
    vat: after.company.vat,
    address: after.company.address,
    city: after.company.city,
    country: after.company.country,
    emails: after.company.emails.map((email) => ({ ...email })),
    phones: after.company.phones.map((phone) => ({
      ...phone,
      normalised: normalisePhone(phone.value),
    })),
    contactFormUrl: after.company.contactFormUrl,
    sources: unique(after.company.sources),
  };

  return {
    domain: after.domain,
    registrableDomain: after.domain.replace(/^www\./i, '').toLowerCase(),
    status,
    company,
    offers,
    usage,
  };
}

/**
 * A named seller with at least one stage-03 offer is profiled. Market evidence,
 * price and email are reported separately; a missing 04 market observation must
 * never remove a seller that stage 03 selected.
 */
export function deriveCompanyProfileStatus(
  name: string | null,
  offers: readonly CompanyProfileOffer[],
): CompanyProfileStatus {
  const named = (name ?? '').trim().length > 0;

  return named && offers.length > 0 ? 'profiled' : 'needs_review';
}

/** Company-level view: each distinct price appears once, with all its offers. */
export function summariseCompanyProfile(
  profile: CompanyProfile,
): CompanyProfileSummary {
  const prices = new Map<
    string,
    { price: CompanyProfilePrice; offerIds: Set<string> }
  >();

  for (const offer of profile.offers) {
    for (const price of offer.prices) {
      const key = priceKey(price);
      const existing = prices.get(key);

      if (existing) {
        existing.offerIds.add(offer.id);
      } else {
        prices.set(key, {
          price,
          offerIds: new Set([offer.id]),
        });
      }
    }
  }

  return {
    domain: profile.domain,
    registrableDomain: profile.registrableDomain,
    status: profile.status,
    legal: {
      name: profile.company.name,
      legalName: profile.company.legalName,
      code: profile.company.code,
      vat: profile.company.vat,
      address: profile.company.address,
      city: profile.company.city,
      country: profile.company.country,
    },
    offers: profile.offers.map((offer) => ({
      id: offer.id,
      item: offer.item,
      verdict: offer.verdict,
      marketStatus: offer.market.status,
      pageId: offer.pageIds[0] ?? offer.id,
      priceCount: offer.prices.length,
    })),
    prices: [...prices.values()].map(({ price, offerIds }) => ({
      ...price,
      offerIds: [...offerIds],
    })),
    emails: profile.company.emails.map((email) => email.value),
    phones: profile.company.phones.map((phone) => phone.value),
    contactFormUrl: profile.company.contactFormUrl,
    sources: profile.company.sources,
    usage: profile.usage,
  };
}

function normalisePhone(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (
    !trimmed.startsWith('+') ||
    digits.length < 8 ||
    digits.length > 15
  ) {
    return null;
  }

  return `+${digits}`;
}

function sumNullable(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;

  return (left ?? 0) + (right ?? 0);
}

function samePrice(
  left: CompanyProfilePrice,
  right: CompanyProfilePrice,
): boolean {
  return priceKey(left) === priceKey(right);
}

function priceKey(price: CompanyProfilePrice): string {
  return [
    price.amount,
    price.currency ?? '',
    price.unit ?? '',
    price.priceType,
    price.variant ?? '',
    price.sourceUrl,
    price.quote,
  ].join('|');
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
