import type { DeepSeekResponse } from '../../types.js';
import { parseJsonObject } from '../../lib/parse-json-object.js';
import type {
  ProfilingDomainInput,
  ProfilingLink,
  ProfilingOffer,
} from './company-profiling.input.js';
import { deriveMarket } from './company-profiling.market.js';
import { decideEvidenceGeography } from './company-profiling.geography.js';
import {
  COMPANY_PROFILING_PROMPT,
  COMPANY_PROFILING_PROMPT_VERSION,
} from './company-profiling.prompt.js';
import {
  companyProfilingAnswerSchema,
  emailItemSchema,
  marketEvidenceItemSchema,
  phoneItemSchema,
  priceItemSchema,
  type CompanyProfilingAnswer,
} from './company-profiling.schema.js';
import type { MarketDecision, MarketEvidence } from './company-profiling.types.js';

/** One domain's first profiling call: the shared run context plus its 04.1 entry. */
export type FirstCallContext = {
  targetCountry: string;
  targetLanguage: string;
  product: {
    productName: string;
    categoryName: string;
    generalCategoryName: string;
    description?: string;
  };
  domain: ProfilingDomainInput;
  model: string;
};

export type FirstCallUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type FirstCallPrice = {
  amount: number;
  currency: string | null;
  unit: 'm2' | 'm' | 'pc' | 'pack' | null;
  vatIncluded: boolean | null;
  priceType: 'exact' | 'from';
  variant: string | null;
  quote: string;
  sourceUrl: string;
};

export type FirstCallCompany = {
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
    label: 'sales' | 'general' | null;
    sourceUrl: string;
  }>;
  contactFormUrl: string | null;
  /** Supplied URLs that actually contributed a kept fact. */
  sources: string[];
};

export type FirstCallOffer = {
  id: string;
  item: string;
  /** Inherited from 03, never from the model. */
  verdict: 'a' | 'b';
  traits: ProfilingOffer['traits'];
  marketFrom03: ProfilingOffer['marketFrom03'];
  sourceUrl: string;
  market: MarketDecision;
  prices: FirstCallPrice[];
};

export type DroppedReason =
  | 'unknown_offer'
  | 'missing_offer'
  | 'duplicate_offer'
  | 'invalid_evidence'
  | 'source_not_supplied'
  | 'quote_not_found'
  | 'direction_unsupported'
  | 'geography_unsupported'
  | 'unknown_applies_to'
  | 'offer_scope_mismatch'
  | 'invalid_price'
  | 'price_for_b_offer'
  | 'price_amount_mismatch'
  | 'price_currency_unknown'
  | 'price_product_mismatch'
  | 'invalid_email'
  | 'email_not_public'
  | 'invalid_phone'
  | 'phone_not_public'
  | 'contact_form_not_supplied'
  | 'contact_form_not_supported'
  | 'next_page_not_in_list';

export type DroppedItem = {
  kind:
    | 'offer'
    | 'evidence'
    | 'price'
    | 'email'
    | 'phone'
    | 'contact_form'
    | 'next_page';
  offerId?: string;
  reason: DroppedReason;
  detail: string;
};

export type FirstCallResult = {
  domain: string;
  promptVersion: string;
  model: string;
  usage: FirstCallUsage | null;
  company: FirstCallCompany;
  offers: FirstCallOffer[];
  nextPage: ProfilingLink | null;
  dropped: DroppedItem[];
  raw: string;
  notes: string | null;
};

/** The model-facing payload: one domain, never more. */
export function buildFirstCallPayload(context: FirstCallContext) {
  return {
    targetCountry: context.targetCountry,
    targetLanguage: context.targetLanguage,
    product: context.product,
    domain: context.domain.domain,
    offers: context.domain.offers,
    excerpts: context.domain.excerpts,
    homepage: context.domain.homepage,
    links: context.domain.links,
  };
}

export type FirstCallChat = (
  systemPrompt: string,
  userContent: object,
) => Promise<DeepSeekResponse>;

/**
 * Runs the first call and validates every quote against the page it names.
 *
 * The model is not trusted for market conclusions either: only validated
 * evidence reaches `deriveMarket()`.
 */
export async function runFirstCall(
  context: FirstCallContext,
  chat: FirstCallChat,
): Promise<FirstCallResult> {
  const response = await chat(
    COMPANY_PROFILING_PROMPT,
    buildFirstCallPayload(context),
  );
  const raw = response.choices[0]?.message.content ?? '';
  const answer = companyProfilingAnswerSchema.parse(parseJsonObject(raw));

  return validateFirstCall(context, answer, {
    raw,
    usage: readUsage(response),
  });
}

/** Pure validation: usable without an LLM call in the tests. */
export function validateFirstCall(
  context: FirstCallContext,
  answer: CompanyProfilingAnswer,
  meta: { raw: string; usage: FirstCallUsage | null },
  extraTexts: ReadonlyMap<string, string> = new Map(),
): FirstCallResult {
  const texts = suppliedTexts(context.domain, extraTexts);
  const offerIds = new Set(context.domain.offers.map((offer) => offer.id));
  const dropped: DroppedItem[] = [];
  const blocks = groupAnswerOffers(answer, offerIds, dropped);
  const evidence = collectEvidence(
    blocks,
    texts,
    offerIds,
    dropped,
    context.targetCountry,
  );
  const prices = collectPrices(
    blocks,
    context.domain,
    context.product.productName,
    texts,
    dropped,
  );
  const company = validateCompany(answer.company, context.domain, texts, dropped);
  const nextPage = resolveNextPage(answer.nextPage, context.domain, dropped);

  const offers: FirstCallOffer[] = context.domain.offers.map((offer) => ({
    id: offer.id,
    item: offer.item,
    verdict: offer.verdict,
    traits: offer.traits,
    marketFrom03: offer.marketFrom03,
    sourceUrl: offer.sourceUrl,
    market: deriveMarket(offer.id, evidence, offer.marketFrom03),
    prices: prices.get(offer.id) ?? [],
  }));

  const sources = unique([
    ...(context.domain.homepage ? [context.domain.homepage.url] : []),
    ...company.emails.map((email) => email.sourceUrl),
    ...company.phones.map((phone) => phone.sourceUrl),
    ...offers.flatMap((offer) => [
      ...offer.market.evidence.map((item) => item.sourceUrl),
      ...offer.prices.map((price) => price.sourceUrl),
    ]),
  ]);

  return {
    domain: context.domain.domain,
    promptVersion: COMPANY_PROFILING_PROMPT_VERSION,
    model: context.model,
    usage: meta.usage,
    company: { ...company, sources },
    offers,
    nextPage,
    dropped,
    raw: meta.raw,
    notes: answer.notes,
  };
}

type AnswerBlock = {
  id: string;
  marketEvidence: unknown[];
  prices: unknown[];
};

function groupAnswerOffers(
  answer: CompanyProfilingAnswer,
  offerIds: ReadonlySet<string>,
  dropped: DroppedItem[],
): Map<string, AnswerBlock> {
  const blocks = new Map<string, AnswerBlock>();

  for (const offer of answer.offers) {
    if (!offerIds.has(offer.id)) {
      dropped.push({
        kind: 'offer',
        offerId: offer.id,
        reason: 'unknown_offer',
        detail: 'The model returned an offer id that 03 did not supply.',
      });
      continue;
    }

    const existing = blocks.get(offer.id);

    if (existing) {
      existing.marketEvidence.push(...offer.marketEvidence);
      existing.prices.push(...offer.prices);
      dropped.push({
        kind: 'offer',
        offerId: offer.id,
        reason: 'duplicate_offer',
        detail: 'Duplicate offer block merged into the first one.',
      });
      continue;
    }

    blocks.set(offer.id, {
      id: offer.id,
      marketEvidence: [...offer.marketEvidence],
      prices: [...offer.prices],
    });
  }

  for (const id of offerIds) {
    if (!blocks.has(id)) {
      dropped.push({
        kind: 'offer',
        offerId: id,
        reason: 'missing_offer',
        detail: 'The model returned no block for this 03 offer; it stays with no evidence.',
      });
    }
  }

  return blocks;
}

function suppliedTexts(
  domain: ProfilingDomainInput,
  extraTexts: ReadonlyMap<string, string>,
): Map<string, string> {
  const texts = new Map<string, string>();

  const add = (url: string, text: string): void => {
    const existing = texts.get(url);
    texts.set(url, existing === undefined ? text : `${existing}\n${text}`);
  };

  if (domain.homepage) add(domain.homepage.url, domain.homepage.text);

  for (const excerpt of domain.excerpts) add(excerpt.url, excerpt.text);
  for (const [url, text] of extraTexts) add(url, text);

  return texts;
}

function collectEvidence(
  blocks: ReadonlyMap<string, AnswerBlock>,
  texts: ReadonlyMap<string, string>,
  offerIds: ReadonlySet<string>,
  dropped: DroppedItem[],
  targetCountry: string,
): MarketEvidence[] {
  const evidence: MarketEvidence[] = [];
  const seen = new Set<string>();

  for (const block of blocks.values()) {
    for (const raw of block.marketEvidence) {
      const parsed = marketEvidenceItemSchema.safeParse(raw);

      if (!parsed.success) {
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'invalid_evidence',
          detail: firstIssue(parsed.error),
        });
        continue;
      }

      const item = parsed.data;
      const text = texts.get(item.sourceUrl);

      if (text === undefined) {
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'source_not_supplied',
          detail: `sourceUrl is not one of the supplied pages: ${item.sourceUrl}`,
        });
        continue;
      }

      if (!includesQuote(text, item.quote)) {
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'quote_not_found',
          detail: `Quote not found at ${item.sourceUrl}: ${shorten(item.quote)}`,
        });
        continue;
      }

      if (
        item.channel === 'delivery' &&
        item.direction === 'restricts' &&
        !hasExplicitRestriction(item.quote)
      ) {
        // "We deliver across Poland" is not "we deliver only in Poland"; it
        // leaves the target-country channel unknown instead of closing it.
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'direction_unsupported',
          detail: `Delivery restriction has no explicit limitation: ${shorten(item.quote)}`,
        });
        continue;
      }

      const geography = decideEvidenceGeography({
        channel: item.channel,
        direction: item.direction,
        quote: item.quote,
        sourceText: text,
        sourceUrl: item.sourceUrl,
        targetCountry,
      });

      if (!geography.supported) {
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'geography_unsupported',
          detail: geography.detail,
        });
        continue;
      }

      if (
        item.scope === 'offer' &&
        (item.appliesTo.length !== 1 || item.appliesTo[0] !== block.id)
      ) {
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'offer_scope_mismatch',
          detail: `offer-scoped evidence must apply only to its own block (${block.id}), got: ${item.appliesTo.join(', ')}`,
        });
        continue;
      }

      if (!item.appliesTo.every((id) => offerIds.has(id))) {
        dropped.push({
          kind: 'evidence',
          offerId: block.id,
          reason: 'unknown_applies_to',
          detail: `appliesTo names an unknown offer: ${item.appliesTo.join(', ')}`,
        });
        continue;
      }

      const canonical: MarketEvidence = {
        ...item,
        direction: geography.effect === 'deny' ? 'restricts' : 'allows',
        appliesTo: unique(item.appliesTo),
      };
      const key = evidenceKey(canonical);

      if (seen.has(key)) continue;

      seen.add(key);
      evidence.push(canonical);
    }
  }

  return evidence;
}

function collectPrices(
  blocks: ReadonlyMap<string, AnswerBlock>,
  domain: ProfilingDomainInput,
  productName: string,
  texts: ReadonlyMap<string, string>,
  dropped: DroppedItem[],
): Map<string, FirstCallPrice[]> {
  const byOffer = new Map<string, FirstCallPrice[]>();
  // The same catalogue quote can legitimately back two offers (the product
  // page and the catalogue entry); dedupe only inside one offer.
  const seenByOffer = new Map<string, Set<string>>();

  for (const offer of domain.offers) {
    const block = blocks.get(offer.id);

    if (!block) continue;

    for (const raw of block.prices) {
      const parsed = priceItemSchema.safeParse(raw);

      if (!parsed.success) {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'invalid_price',
          detail: firstIssue(parsed.error),
        });
        continue;
      }

      if (offer.verdict !== 'a') {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'price_for_b_offer',
          detail: 'Prices are accepted only for verdict "a" offers.',
        });
        continue;
      }

      const price = parsed.data;
      const text = texts.get(price.sourceUrl);

      if (text === undefined) {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'source_not_supplied',
          detail: `sourceUrl is not one of the supplied pages: ${price.sourceUrl}`,
        });
        continue;
      }

      if (!includesQuote(text, price.quote)) {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'quote_not_found',
          detail: `Price quote not found at ${price.sourceUrl}: ${shorten(price.quote)}`,
        });
        continue;
      }

      if (
        !(price.amount > 0) ||
        !amountInPriceExpression(price.quote, price.amount)
      ) {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'price_amount_mismatch',
          detail: `Amount ${price.amount} is not part of a price expression: ${shorten(price.quote)}`,
        });
        continue;
      }

      if (
        price.currency !== null &&
        !KNOWN_CURRENCIES.has(price.currency.toUpperCase())
      ) {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'price_currency_unknown',
          detail: `Unknown currency: ${price.currency}`,
        });
        continue;
      }

      const entry = priceEntry(text, price.quote);

      if (
        !priceEntryMatchesOffer(
          entry,
          offer.item || productName,
          price.variant,
        )
      ) {
        dropped.push({
          kind: 'price',
          offerId: offer.id,
          reason: 'price_product_mismatch',
          detail: `The price quote is not in this offer's catalogue entry: ${shorten(price.quote)}`,
        });
        continue;
      }

      const canonical: FirstCallPrice = {
        ...price,
        currency: price.currency === null ? null : price.currency.toUpperCase(),
      };
      const key = priceKey(canonical);
      const seen = seenByOffer.get(offer.id) ?? new Set<string>();

      if (seen.has(key)) continue;

      seen.add(key);
      seenByOffer.set(offer.id, seen);

      const list = byOffer.get(offer.id) ?? [];
      list.push(canonical);
      byOffer.set(offer.id, list);
    }
  }

  return byOffer;
}

function validateCompany(
  raw: CompanyProfilingAnswer['company'],
  domain: ProfilingDomainInput,
  texts: ReadonlyMap<string, string>,
  dropped: DroppedItem[],
): Omit<FirstCallCompany, 'sources'> {
  const emails: FirstCallCompany['emails'] = [];
  const phones: FirstCallCompany['phones'] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (const rawEmail of raw.emails) {
    const parsed = emailItemSchema.safeParse(rawEmail);

    if (!parsed.success) {
      dropped.push({
        kind: 'email',
        reason: 'invalid_email',
        detail: firstIssue(parsed.error),
      });
      continue;
    }

    const email = parsed.data;

    if (!EMAIL_PATTERN.test(email.value)) {
      dropped.push({
        kind: 'email',
        reason: 'invalid_email',
        detail: `Not an email address: ${email.value}`,
      });
      continue;
    }

    const lowered = email.value.toLowerCase();

    if (seenEmails.has(lowered) || PLACEHOLDER_EMAIL.test(lowered)) {
      if (PLACEHOLDER_EMAIL.test(lowered)) {
        dropped.push({
          kind: 'email',
          reason: 'invalid_email',
          detail: `Placeholder email: ${email.value}`,
        });
      }
      continue;
    }

    const source = findTextFor(texts, email.sourceUrl, (text) =>
      emailsInText(text).includes(lowered),
    );

    if (!source) {
      dropped.push({
        kind: 'email',
        reason: 'email_not_public',
        detail: `Email is not printed on a supplied page: ${email.value}`,
      });
      continue;
    }

    seenEmails.add(lowered);
    emails.push({ ...email, sourceUrl: source });
  }

  for (const rawPhone of raw.phones) {
    const parsed = phoneItemSchema.safeParse(rawPhone);

    if (!parsed.success) {
      dropped.push({
        kind: 'phone',
        reason: 'invalid_phone',
        detail: firstIssue(parsed.error),
      });
      continue;
    }

    const phone = parsed.data;
    const digits = digitsOf(phone.value);

    if (digits.length < 7) {
      dropped.push({
        kind: 'phone',
        reason: 'invalid_phone',
        detail: `Not a phone number: ${phone.value}`,
      });
      continue;
    }

    if (seenPhones.has(digits)) continue;

    const source = findTextFor(texts, phone.sourceUrl, (text) =>
      phoneExpressions(text).some(
        (candidate) => digitsOf(candidate) === digits,
      ),
    );

    if (!source) {
      dropped.push({
        kind: 'phone',
        reason: 'phone_not_public',
        detail: `Phone is not printed on a supplied page: ${phone.value}`,
      });
      continue;
    }

    seenPhones.add(digits);
    phones.push({ ...phone, sourceUrl: source });
  }

  let contactFormUrl: string | null = null;

  if (raw.contactFormUrl !== null) {
    const url = raw.contactFormUrl;
    const supplied = domain.links.find((link) => sameUrl(link.url, url));
    const printed = [...texts.values()].some((text) => text.includes(url));

    if (!supplied && !printed) {
      dropped.push({
        kind: 'contact_form',
        reason: 'contact_form_not_supplied',
        detail: `Contact form URL was not supplied: ${url}`,
      });
    } else if (!contactFormSupported(url, domain, texts)) {
      // A contact page link is a valid nextPage, but not proof of a form.
      dropped.push({
        kind: 'contact_form',
        reason: 'contact_form_not_supported',
        detail: `The supplied content does not show a form at: ${url}`,
      });
    } else {
      contactFormUrl = supplied?.url ?? url;
    }
  }

  return {
    name: raw.name,
    legalName: raw.legalName,
    code: raw.code,
    vat: raw.vat,
    address: raw.address,
    city: raw.city,
    country: raw.country,
    emails,
    phones,
    contactFormUrl,
  };
}

function resolveNextPage(
  nextPage: CompanyProfilingAnswer['nextPage'],
  domain: ProfilingDomainInput,
  dropped: DroppedItem[],
): ProfilingLink | null {
  if (nextPage === null) return null;

  const link = domain.links.find((candidate) => candidate.id === nextPage.id);

  if (!link) {
    dropped.push({
      kind: 'next_page',
      reason: 'next_page_not_in_list',
      detail: `nextPage.id is not in this domain's shortlist: ${nextPage.id}`,
    });
    return null;
  }

  return link;
}

function findTextFor(
  texts: ReadonlyMap<string, string>,
  preferredUrl: string,
  matches: (text: string) => boolean,
): string | null {
  const preferred = texts.get(preferredUrl);

  if (preferred !== undefined && matches(preferred)) return preferredUrl;

  for (const [url, text] of texts) {
    if (matches(text)) return url;
  }

  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const PLACEHOLDER_EMAIL =
  /@(example\.(com|org|net)|domain\.(com|lt)|email\.com)$/i;
const KNOWN_CURRENCIES = new Set([
  'EUR',
  'USD',
  'GBP',
  'PLN',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'CHF',
  'UAH',
]);

function normalizeWhitespace(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function includesQuote(text: string, quote: string): boolean {
  const needle = normalizeWhitespace(quote);

  return (
    needle.length > 0 && normalizeWhitespace(text).includes(needle)
  );
}

const PRICE_MARKER =
  /(?:€|\beur\b|\busd\b|\bgbp\b|\bpln\b|\bkaina\b|\bprice\b|\/\s*m(?:2|²)?)/iu;
const FORM_MARKER = /(?:forma|form|uzklaus|inquiry)/u;
const EMAIL_TOKEN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_TOKEN =
  /(?<![\p{L}\d])(?:\+?\d[\d\s().-]{5,}\d)(?![\p{L}\d])/gu;
const TOKEN_STOPWORDS = new Set([
  'a',
  'ir',
  'su',
  'is',
  'uz',
  'nuo',
  'iki',
  'ar',
  'arba',
  'bei',
  'the',
  'and',
  'of',
  'for',
  'to',
]);

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

function searchable(value: string): string {
  return value
    .replace(/×/g, 'x')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

const NEGATIVE_DELIVERY =
  /\b(?:nepristat\w*|neissiun\w*|nie wysyl\w*|nie dostarcz\w*|niedost\w*|do not deliver|cannot deliver|no delivery|nicht\w*|kein\w*)\b/u;
const EXCLUSIVE_SCOPE =
  /\b(?:tik|tylko|jedynie|only|exclusively|nur|tikai|vain|wylacznie|ausschliesslich)\b/gu;
const PLACE_SCOPE =
  /\b(?:lietuv\w*|lenkij\w*|polsk\w*|polsce|polski|latvij\w*|latvia\w*|estij\w*|eesti|vokietij\w*|deutsch\w*|niemc\w*|slow\w*|cesk\w*|suom\w*|kraj\w*|country|abroad|uzsien\w*|europ\w*|miest\w*|mieste|region\w*|teritor\w*|sandeli\w*|parduotuv\w*|vilni\w*|kaun\w*|klaip\w*|siaul\w*|panevez\w*|warsz\w*|krakow\w*|gdansk\w*|ryg\w*|tallin\w*)\b/u;
const TIME_SCOPE =
  /\b(?:darbo dien\w*|dien\w*|valand\w*|savait\w*|menes\w*|metai|metus|laiku|ryto|vakaro|nakt\w*|weekday\w*|week\w*|days?|hours?|time|termin\w*|iki|nuo|per)\b/u;

/**
 * A delivery restriction for another country is only a restriction for the
 * target market when it is explicit ("only", a negation, or a refusal) and the
 * explicit word scopes a place, not a delivery time. "We deliver only on
 * weekdays to Lithuania" is not a country restriction; "only in Poland" is.
 */
function hasExplicitRestriction(quote: string): boolean {
  const text = searchable(quote);

  if (NEGATIVE_DELIVERY.test(text)) return true;

  for (const match of text.matchAll(EXCLUSIVE_SCOPE)) {
    const after = text.slice(
      (match.index ?? 0) + (match[0]?.length ?? 0),
      (match.index ?? 0) + (match[0]?.length ?? 0) + 80,
    );
    const place = after.search(PLACE_SCOPE);
    const time = after.search(TIME_SCOPE);

    if (place >= 0 && (time < 0 || place < time)) return true;
  }

  return false;
}

/** The price number must be part of a price expression, not a dimension or a code. */
function amountInPriceExpression(quote: string, amount: number): boolean {
  const text = normalizeWhitespace(quote);

  for (const match of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const value = Number((match[0] ?? '').replace(',', '.'));

    if (Math.abs(value - amount) >= 0.005) continue;

    const index = match.index ?? 0;
    const length = match[0]?.length ?? 0;
    const window = text.slice(
      Math.max(0, index - 24),
      index + length + 24,
    );

    if (PRICE_MARKER.test(window)) return true;
  }

  return false;
}

type TextSection = {
  start: number;
  level: number;
  text: string;
};

/**
 * Markdown headings delimit catalogue entries. A section runs from its heading
 * to the next heading of the same or a higher level, so a `###` product entry
 * ends at the next `###` and not at the end of the page.
 */
function headingSections(text: string): TextSection[] {
  const headings = [...text.matchAll(/^(#{1,6})[ \t]+(.+?)\s*$/gm)].map(
    (match) => ({
      start: match.index ?? 0,
      level: (match[1] ?? '').length,
    }),
  );

  if (headings.length === 0) return [];

  return headings.map((heading, index) => {
    let end = text.length;

    for (let next = index + 1; next < headings.length; next += 1) {
      if ((headings[next]?.level ?? 0) <= heading.level) {
        end = headings[next]?.start ?? text.length;
        break;
      }
    }

    return {
      start: heading.start,
      level: heading.level,
      text: text.slice(heading.start, end),
    };
  });
}

/** The catalogue entry that contains the price quote, or the whole page. */
function priceEntry(text: string, quote: string): string {
  const needle = normalizeWhitespace(quote);
  let best: TextSection | null = null;

  for (const section of headingSections(text)) {
    if (!normalizeWhitespace(section.text).includes(needle)) continue;
    if (!best || section.start > best.start) best = section;
  }

  return best?.text ?? text;
}

function tokensOf(value: string): string[] {
  return searchable(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.replace(/(?:mm|cm|m)$/u, ''))
    .filter(
      (token) =>
        token.length >= 2 &&
        /[a-z]/.test(token) &&
        !TOKEN_STOPWORDS.has(token),
    );
}

function matchesTokens(haystack: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;

  const matched = tokens.filter((token) => haystack.includes(token)).length;
  const missingDigits = tokens.some(
    (token) => /\d/.test(token) && !haystack.includes(token),
  );

  return matched / tokens.length >= 0.75 && !missingDigits;
}

/**
 * The price must sit in the entry of this exact offer. The 03 item is the
 * anchor; a model-provided variant must also appear in the entry when given.
 */
function priceEntryMatchesOffer(
  entry: string,
  item: string,
  variant: string | null,
): boolean {
  const haystack = searchable(entry);

  if (!matchesTokens(haystack, tokensOf(item))) return false;

  if (variant !== null && variant.trim().length > 0) {
    if (!matchesTokens(haystack, tokensOf(variant))) return false;
  }

  return true;
}

function emailsInText(text: string): string[] {
  return [...text.matchAll(EMAIL_TOKEN)].map((match) =>
    (match[0] ?? '').toLowerCase(),
  );
}

/** One contiguous phone expression; digits from unrelated page parts never combine. */
function phoneExpressions(text: string): string[] {
  return [...text.matchAll(PHONE_TOKEN)]
    .map((match) => (match[0] ?? '').trim())
    .filter((candidate) => {
      const digits = digitsOf(candidate);

      return digits.length >= 7 && digits.length <= 15;
    });
}

/** A contact link is not proof of a form; the supplied anchor or text must say so. */
function contactFormSupported(
  url: string,
  domain: ProfilingDomainInput,
  texts: ReadonlyMap<string, string>,
): boolean {
  const own = texts.get(url);

  if (own !== undefined && FORM_MARKER.test(searchable(own))) return true;

  const link = domain.links.find((candidate) => sameUrl(candidate.url, url));

  if (link && FORM_MARKER.test(searchable(link.anchor))) return true;

  for (const text of texts.values()) {
    const index = text.indexOf(url);

    if (index === -1) continue;

    const window = text.slice(
      Math.max(0, index - 240),
      index + url.length + 240,
    );

    if (FORM_MARKER.test(searchable(window))) return true;
  }

  return false;
}

function evidenceKey(item: MarketEvidence): string {
  return [
    item.channel,
    item.direction,
    item.scope,
    [...item.appliesTo].sort().join(','),
    item.sourceUrl,
    item.quote,
  ].join('|');
}

function priceKey(price: FirstCallPrice): string {
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

function sameUrl(left: string, right: string): boolean {
  if (left === right) return true;

  try {
    const a = new URL(left);
    const b = new URL(right);

    return (
      a.hostname.replace(/^www\./, '').toLowerCase() ===
        b.hostname.replace(/^www\./, '').toLowerCase() &&
      a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '')
    );
  } catch {
    return false;
  }
}

function shorten(value: string): string {
  const text = normalizeWhitespace(value);

  return text.length <= 120 ? text : `${text.slice(0, 117)}…`;
}

function firstIssue(error: {
  issues: ReadonlyArray<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
  }>;
}): string {
  const issue = error.issues[0];

  if (!issue) return 'Invalid item.';

  return `${issue.path.join('.') || 'item'}: ${issue.message}`;
}

export function readUsage(response: DeepSeekResponse): FirstCallUsage | null {
  const usage = response.usage;

  if (!usage) return null;

  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
  };
}
