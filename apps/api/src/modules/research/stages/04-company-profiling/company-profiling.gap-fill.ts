import type {
  CompanyProfilingInput,
  HomepageScraper,
  ProfilingDomainInput,
  ProfilingLink,
} from './company-profiling.input.js';
import { parseJsonObject } from '../../lib/parse-json-object.js';
import {
  buildFirstCallPayload,
  readUsage,
  validateFirstCall,
  type DroppedItem,
  type FirstCallChat,
  type FirstCallContext,
  type FirstCallPrice,
  type FirstCallResult,
  type FirstCallUsage,
} from './company-profiling.first-call.js';
import {
  COMPANY_PROFILING_FOLLOWUP_PROMPT,
  COMPANY_PROFILING_PROMPT_VERSION,
} from './company-profiling.prompt.js';
import {
  companyProfilingAnswerSchema,
  type CompanyProfilingAnswer,
} from './company-profiling.schema.js';
import type { MarketEvidence, MarketStatus } from './company-profiling.types.js';

const MAX_GAP_PAGE_CHARS = 20_000;
const MIN_NEW_CONTENT_CHARS = 200;

export type GapPage = {
  kind: 'contact';
  url: string;
  title: string | null;
  chars: number;
  error: string | null;
};

/** Exactly one page passed to the follow-up call, after capping. */
export type SecondCallPage = {
  kind: 'contact';
  url: string;
  title: string | null;
  text: string;
};

export type SecondCallInput = {
  prompt: string;
  newPages: SecondCallPage[];
};

export type MarketSnapshot = {
  status: MarketStatus;
  resolvedBy: FirstCallResult['offers'][number]['market']['resolvedBy'];
  conflict: boolean;
  /** The quotes that justify the status, each with its source URL. */
  evidence: MarketEvidence[];
};

export type GapFillOffer = {
  id: string;
  item: string;
  /** Always the stage-03 verdict. */
  verdict: 'a' | 'b';
  before: MarketSnapshot;
  after: MarketSnapshot;
  prices: FirstCallPrice[];
};

export type GapFillCompany = {
  before: {
    emails: string[];
    contactFormUrl: string | null;
  };
  after: {
    emails: string[];
    phones: string[];
    contactFormUrl: string | null;
  };
};

export type GapFillResult = {
  domain: string;
  promptVersion: string;
  model: string;
  pages: GapPage[];
  /** The exact capped text sent to the second call; empty when it did not run. */
  newPages: SecondCallPage[];
  additionalFetches: number;
  additionalLlmCalls: number;
  usage: {
    first: FirstCallUsage | null;
    second: FirstCallUsage | null;
  };
  offers: GapFillOffer[];
  company: GapFillCompany;
  nextPage: ProfilingLink | null;
  dropped: DroppedItem[];
  /** Raw second answer; useful when comparing follow-up prompt changes. */
  secondRaw: string;
  /** The full merged result after 04.3. */
  after: FirstCallResult;
};

type FetchedPage = SecondCallPage;

/**
 * Fills the two gaps the first call left open: market (a delivery/pickup page)
 * and contact (a contact page). Both pages are fetched, then one follow-up call
 * merges their facts into the first answer. The merge keeps every already
 * proven price and contact even when the second answer omits it.
 */
export async function fillProfilingGaps(
  input: CompanyProfilingInput,
  first: FirstCallResult,
  scrape: HomepageScraper,
  chat: FirstCallChat,
  onStage?: (stage: string) => Promise<void>,
  onSecondCall?: (input: SecondCallInput) => void,
): Promise<GapFillResult> {
  const domain = input.domains.find((entry) => entry.domain === first.domain);

  if (!domain) {
    throw new Error(`Domain not found in the prepared input: ${first.domain}`);
  }

  const context: FirstCallContext = {
    targetCountry: input.targetCountry,
    targetLanguage: input.targetLanguage,
    product: input.product,
    domain,
    model: first.model,
  };
  const selections = pickGapPages(domain, first);
  const fetched: FetchedPage[] = [];
  const pages: GapPage[] = [];

  for (const selection of selections) {
    await onStage?.(`04.3 Fetching ${selection.kind} page: ${selection.url}`);

    try {
      const scanned = await scrape(selection.url);
      const text = capText(scanned.markdown.trim(), MAX_GAP_PAGE_CHARS);

      if (text.length === 0) throw new Error('empty page text');

      fetched.push({
        kind: selection.kind,
        url: selection.url,
        title: scanned.title,
        text,
      });
      pages.push({
        kind: selection.kind,
        url: selection.url,
        title: scanned.title,
        chars: text.length,
        error: null,
      });
    } catch (cause) {
      pages.push({
        kind: selection.kind,
        url: selection.url,
        title: null,
        chars: 0,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  let after = first;
  let secondUsage: FirstCallUsage | null = null;
  let secondRaw = '';
  let additionalLlmCalls = 0;

  const newChars = fetched.reduce((total, page) => total + page.text.length, 0);
  const newPages = fetched.map((page) => ({ ...page }));

  if (fetched.length > 0 && newChars >= MIN_NEW_CONTENT_CHARS) {
    await onStage?.('04.3 Second profiling call...');

    const previous = companyProfilingAnswerSchema.parse(
      parseJsonObject(first.raw),
    );
    onSecondCall?.({
      prompt: COMPANY_PROFILING_FOLLOWUP_PROMPT,
      newPages,
    });
    const response = await chat(COMPANY_PROFILING_FOLLOWUP_PROMPT, {
      ...buildFirstCallPayload(context),
      previous,
      newPages,
    });

    secondRaw = response.choices[0]?.message.content ?? '';
    secondUsage = readUsage(response);

    const next = companyProfilingAnswerSchema.parse(
      parseJsonObject(secondRaw),
    );
    const merged = mergeAnswers(previous, next);
    const extraTexts = new Map(
      fetched.map((page) => [page.url, page.text] as const),
    );

    after = validateFirstCall(
      context,
      merged,
      { raw: secondRaw, usage: secondUsage },
      extraTexts,
    );
    additionalLlmCalls = 1;
  }

  return {
    domain: first.domain,
    promptVersion: COMPANY_PROFILING_PROMPT_VERSION,
    model: first.model,
    pages,
    newPages: additionalLlmCalls > 0 ? newPages : [],
    additionalFetches: pages.length,
    additionalLlmCalls,
    usage: { first: first.usage, second: secondUsage },
    offers: first.offers.map((beforeOffer) => {
      const afterOffer =
        after.offers.find((offer) => offer.id === beforeOffer.id) ?? beforeOffer;

      return {
        id: afterOffer.id,
        item: afterOffer.item,
        verdict: afterOffer.verdict,
        before: snapshot(beforeOffer),
        after: snapshot(afterOffer),
        prices: afterOffer.prices,
      };
    }),
    company: {
      before: {
        emails: first.company.emails.map((email) => email.value),
        contactFormUrl: first.company.contactFormUrl,
      },
      after: {
        emails: after.company.emails.map((email) => email.value),
        phones: after.company.phones.map((phone) => phone.value),
        contactFormUrl: after.company.contactFormUrl,
      },
    },
    nextPage: first.nextPage,
    dropped: uniqueDropped(after.dropped),
    secondRaw,
    after,
  };
}

/** The merged answer repeats some old facts; keep one reason per rejected item. */
function uniqueDropped(items: readonly DroppedItem[]): DroppedItem[] {
  const seen = new Set<string>();
  const dropped: DroppedItem[] = [];

  for (const item of items) {
    const key = [
      item.kind,
      item.offerId ?? '',
      item.reason,
      item.detail,
    ].join('|');

    if (seen.has(key)) continue;

    seen.add(key);
    dropped.push(item);
  }

  return dropped;
}

/** Whether 04.3 has anything to fetch and ask again for this domain. */
export function needsGapFill(first: FirstCallResult): boolean {
  return hasContactGap(first);
}

/** Market is never a gap; 04 only fills missing contacts. */
export function describeGaps(first: FirstCallResult): {
  market: boolean;
  contact: boolean;
} {
  return {
    market: false,
    contact: hasContactGap(first),
  };
}

export type GapPlan = {
  market: boolean;
  contact: boolean;
  links: ProfilingLink[];
  pages: Array<{ kind: GapPage['kind']; url: string }>;
};

/** Deterministic plan for 04.3: contact gap, supplied links and chosen page. */
export function planGapFill(
  domain: ProfilingDomainInput,
  first: FirstCallResult,
): GapPlan {
  return {
    market: false,
    contact: hasContactGap(first),
    links: [...domain.links],
    pages: pickGapPages(domain, first),
  };
}

/** Only a missing contact opens 04.3; the page may also carry market evidence. */
function pickGapPages(
  domain: ProfilingDomainInput,
  first: FirstCallResult,
): Array<{ kind: GapPage['kind']; url: string }> {
  const selected: Array<{ kind: GapPage['kind']; url: string }> = [];
  const used = new Set<string>();

  const add = (kind: GapPage['kind'], link: ProfilingLink): void => {
    if (used.has(link.url)) return;

    used.add(link.url);
    selected.push({ kind, url: link.url });
  };

  if (hasContactGap(first)) {
    const contact =
      first.nextPage?.kind === 'contact'
        ? first.nextPage
        : domain.links.find((candidate) => candidate.kind === 'contact');

    if (contact) add('contact', contact);
  }

  return selected;
}

function hasContactGap(first: FirstCallResult): boolean {
  return (
    first.company.emails.length === 0 &&
    first.company.contactFormUrl === null
  );
}

/**
 * Merge the second answer into the first one. The second answer may omit an
 * old price or contact; the old value stays because it is copied here, not
 * replaced.
 */
function mergeAnswers(
  previous: CompanyProfilingAnswer,
  next: CompanyProfilingAnswer,
): CompanyProfilingAnswer {
  const offers = new Map<
    string,
    { id: string; marketEvidence: unknown[]; prices: unknown[] }
  >();

  for (const offer of previous.offers) {
    offers.set(offer.id, {
      id: offer.id,
      marketEvidence: [...offer.marketEvidence],
      prices: [...offer.prices],
    });
  }

  for (const offer of next.offers) {
    const existing = offers.get(offer.id);

    if (!existing) {
      offers.set(offer.id, {
        id: offer.id,
        marketEvidence: [...offer.marketEvidence],
        prices: [...offer.prices],
      });
      continue;
    }

    existing.marketEvidence.push(...offer.marketEvidence);
    existing.prices.push(...offer.prices);
  }

  return {
    company: {
      ...next.company,
      name: next.company.name ?? previous.company.name,
      legalName: next.company.legalName ?? previous.company.legalName,
      code: next.company.code ?? previous.company.code,
      vat: next.company.vat ?? previous.company.vat,
      address: next.company.address ?? previous.company.address,
      city: next.company.city ?? previous.company.city,
      country: next.company.country ?? previous.company.country,
      emails: [...previous.company.emails, ...next.company.emails],
      phones: [...previous.company.phones, ...next.company.phones],
      // Keep an already proven form; try the new one only when the old is null.
      contactFormUrl:
        previous.company.contactFormUrl ?? next.company.contactFormUrl,
    },
    offers: [...offers.values()],
    // 04.3 ends here; the next page stays the one 04.2 chose.
    nextPage: previous.nextPage,
    notes: next.notes ?? previous.notes,
  };
}

function snapshot(offer: FirstCallResult['offers'][number]): MarketSnapshot {
  return {
    status: offer.market.status,
    resolvedBy: offer.market.resolvedBy,
    conflict: offer.market.conflict,
    evidence: offer.market.evidence,
  };
}

/** Keeps the head and the tail, where contacts and legal details usually sit. */
function capText(text: string, limit: number): string {
  const value = text.trim();

  if (value.length <= limit) return value;

  const marker = '\n…\n';

  if (limit <= marker.length + 2) return value.slice(0, Math.max(0, limit));

  const head = Math.floor((limit - marker.length) * 0.65);
  const tail = limit - marker.length - head;

  return `${value.slice(0, head)}${marker}${value.slice(-tail)}`;
}
