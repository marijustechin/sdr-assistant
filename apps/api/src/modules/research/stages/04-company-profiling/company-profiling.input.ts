import type { PageAssessmentResult } from '../03-page-assessment/page-assessment-result.js';
import type { FirecrawlPage } from '../../lib/firecrawl.js';
import type { MarketFrom03 } from './company-profiling.types.js';

/** The only external call 04.1 makes: one homepage scrape per domain. */
export type HomepageScraper = (url: string) => Promise<FirecrawlPage>;

const MAX_EXCERPT_PAGES = 5;
const MAX_EXCERPT_CHARS = 20_000;
const MAX_HOMEPAGE_CHARS = 20_000;
const MAX_SUMMARY_QUOTE_CHARS = 500;
const MAX_LINKS = 12;

export type ProfilingOffer = {
  /** Stable page id from the 03 result, e.g. `03-0001`; never the URL. */
  id: string;
  item: string;
  verdict: 'a' | 'b';
  traits: Record<string, 'confirmed' | 'differs' | 'unknown'>;
  marketFrom03: MarketFrom03;
  /** Short quote from the page, only for the summary. */
  quote: string | null;
  /** The 03 page this offer came from, so every offer stays traceable. */
  sourceUrl: string;
};

export type ProfilingExcerpt = {
  /** The offer/page id the excerpt belongs to. */
  id: string;
  url: string;
  title: string | null;
  verdict: 'a' | 'b';
  text: string;
  chars: number;
  truncated: boolean;
};

export type ProfilingHomepage = {
  url: string;
  title: string | null;
  text: string;
  /** `03` when the page already existed in the input and was reused. */
  source: '03' | 'scrape';
};

export type ProfilingLink = {
  id: string;
  url: string;
  /** Derived from the URL path when Firecrawl returns no anchor text. */
  anchor: string;
  kind: 'contact';
};

export type ProfilingDomainInput = {
  domain: string;
  /** Every 03 offer, including those without an excerpt. */
  offers: ProfilingOffer[];
  excerpts: ProfilingExcerpt[];
  /** Missing only when the homepage was neither in 03 nor scrapeable. */
  homepage: ProfilingHomepage | null;
  links: ProfilingLink[];
  /** Homepage scrape attempts (0 when the 03 root page was reused). */
  fetchAttempts: number;
  error?: { code: 'fetch_failed'; message: string };
};

export type CompanyProfilingInput = {
  targetCountry: string;
  targetLanguage: string;
  product: PageAssessmentResult['product'];
  domains: ProfilingDomainInput[];
};

export type PrepareProfilingOptions = {
  /** Dev/prompt-iteration path: prepare only these domains. */
  onlyDomains?: readonly string[];
};

/**
 * Builds the 04.1 input: one entry per domain with every 03 offer in the
 * summary, a text-only excerpt budget, the homepage and the link shortlist.
 *
 * Nothing here calls an LLM. The excerpt budget deliberately never drops an
 * offer: a domain with 17 pages keeps all 17 summaries and only five excerpts.
 */
export async function prepareProfilingInput(
  data: PageAssessmentResult,
  scrape: HomepageScraper,
  onStage?: (stage: string) => Promise<void>,
  options: PrepareProfilingOptions = {},
): Promise<CompanyProfilingInput> {
  const entries = options.onlyDomains
    ? data.domains.filter((entry) =>
        options.onlyDomains?.includes(entry.domain),
      )
    : data.domains;
  const domains: ProfilingDomainInput[] = [];

  for (const [index, entry] of entries.entries()) {
    await onStage?.(
      `04.1 Preparing ${entry.domain} (${index + 1}/${entries.length})`,
    );
    domains.push(await prepareDomain(entry, scrape));
  }

  return {
    targetCountry: data.targetCountry,
    targetLanguage: data.targetLanguage,
    product: data.product,
    domains,
  };
}

type DomainEntry = PageAssessmentResult['domains'][number];
type SelectedPage = DomainEntry['pages'][number];

async function prepareDomain(
  entry: DomainEntry,
  scrape: HomepageScraper,
): Promise<ProfilingDomainInput> {
  const offers = entry.pages.map((page, index) => toOffer(page, index));
  const root = entry.pages.find(
    (page) => isRootUrl(page.page.url) && textOf(page).length > 0,
  );

  let homepage: ProfilingHomepage | null = null;
  let links: ProfilingLink[] = [];
  let error: ProfilingDomainInput['error'];
  let fetchAttempts = 0;

  if (root) {
    // The homepage is already in the 03 input: reuse its text, spend no fetch.
    homepage = {
      url: root.page.url,
      title: root.page.title,
      text: capText(textOf(root), MAX_HOMEPAGE_CHARS),
      source: '03',
    };
    // The saved text may still carry contact or delivery links in markdown.
    links = shortlistLinks(
      extractTextLinks(root.page.content ?? '', root.page.url),
      entry.domain,
      root.page.url,
    );
  } else {
    fetchAttempts = 1;

    try {
      const scraped = await scrape(`https://${entry.domain}/`);
      const text = capText(scraped.markdown.trim(), MAX_HOMEPAGE_CHARS);

      homepage = {
        url: scraped.url,
        title: scraped.title,
        text,
        source: 'scrape',
      };
      links = shortlistLinks(
        scraped.links.map((url) => ({ url, anchor: null })),
        entry.domain,
        scraped.url,
      );
    } catch (cause) {
      // A failed homepage fetch is not fatal while 03 supplied page text.
      if (!entry.pages.some((page) => textOf(page).length > 0)) {
        error = {
          code: 'fetch_failed',
          message: cause instanceof Error ? cause.message : String(cause),
        };
      }
    }
  }

  return {
    domain: entry.domain,
    offers,
    excerpts: selectExcerpts(entry.pages, root?.page.url ?? null),
    homepage,
    links,
    fetchAttempts,
    ...(error ? { error } : {}),
  };
}

function toOffer(page: SelectedPage, index: number): ProfilingOffer {
  const note = page.facts.market.note?.trim() || null;

  return {
    id: pageId(index),
    item: page.facts.offer.item ?? page.page.title ?? '',
    verdict: page.verdict,
    traits: Object.fromEntries(
      Object.entries(page.facts.traits).map(([name, trait]) => [
        name,
        trait.match,
      ]),
    ),
    marketFrom03: {
      status: page.facts.market.status,
      note,
      sourceUrl: page.page.url,
      quote: verifiedMarketQuote(page, note),
    },
    quote: page.facts.offer.quote
      ? capText(page.facts.offer.quote, MAX_SUMMARY_QUOTE_CHARS)
      : null,
    sourceUrl: page.page.url,
  };
}

function verifiedMarketQuote(
  page: SelectedPage,
  note: string | null,
): string | null {
  if (!note) return null;

  const haystack = [page.page.title ?? '', page.page.content ?? '']
    .join('\n')
    .replace(/\s+/gu, ' ');

  return haystack.includes(note.replace(/\s+/gu, ' ')) ? note : null;
}

/** 1-based position in the 03 result; stable across 04 retries for one input. */
function pageId(index: number): string {
  return `03-${String(index + 1).padStart(4, '0')}`;
}

function textOf(page: SelectedPage): string {
  return (page.page.content ?? '').trim();
}

/**
 * Picks at most five pages and 20 000 characters of text.
 *
 * Priority is the client's: `a` first, then a page with a price, then the most
 * confirmed traits, then `b`. The text budget is counted on excerpt text only;
 * the offer summary itself is never trimmed. The homepage root page is skipped
 * because its text is already supplied as the homepage.
 */
function selectExcerpts(
  pages: readonly SelectedPage[],
  homepageUrl: string | null,
): ProfilingExcerpt[] {
  const candidates = pages
    .map((page, index) => ({ page, index, text: textOf(page) }))
    .filter(
      (candidate) =>
        candidate.text.length > 0 &&
        (homepageUrl === null || candidate.page.page.url !== homepageUrl),
    )
    .sort(
      (left, right) =>
        verdictRank(left.page) - verdictRank(right.page) ||
        priceRank(left.page) - priceRank(right.page) ||
        confirmedCount(right.page) - confirmedCount(left.page) ||
        left.index - right.index,
    );

  const excerpts: ProfilingExcerpt[] = [];
  let remaining = MAX_EXCERPT_CHARS;

  for (const candidate of candidates) {
    if (excerpts.length >= MAX_EXCERPT_PAGES || remaining <= 0) break;

    const text = capText(candidate.text, remaining);

    excerpts.push({
      id: pageId(candidate.index),
      url: candidate.page.page.url,
      title: candidate.page.page.title,
      verdict: candidate.page.verdict,
      text,
      chars: text.length,
      truncated: text.length < candidate.text.length,
    });
    remaining -= text.length;
  }

  return excerpts;
}

function verdictRank(page: SelectedPage): number {
  return page.verdict === 'a' ? 0 : 1;
}

function priceRank(page: SelectedPage): number {
  return page.facts.offer.evidence_type === 'price' ? 0 : 1;
}

function confirmedCount(page: SelectedPage): number {
  return Object.values(page.facts.traits).filter(
    (trait) => trait.match === 'confirmed',
  ).length;
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

function isRootUrl(raw: string): boolean {
  try {
    return new URL(raw).pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

function bareHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '');
}

function normalizedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    return `${bareHost(url.hostname)}${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function anchorFromUrl(url: URL): string {
  const segment = url.pathname.split('/').filter(Boolean).pop();

  if (!segment) return bareHost(url.hostname);

  return (
    decode(segment)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || bareHost(url.hostname)
  );
}

function searchable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

const CONTACT_WORDS = ['kontakt', 'imprint'];

function linkKind(haystack: string): ProfilingLink['kind'] | null {
  if (CONTACT_WORDS.some((word) => haystack.includes(word))) {
    return 'contact';
  }

  return null;
}

type LinkCandidate = {
  url: string;
  anchor: string | null;
};

/**
 * Pulls link candidates out of saved markdown: inline markdown links, HTML
 * hrefs and bare URLs. Relative markdown/html targets resolve against the page
 * URL. A text without any URL yields no candidates, which keeps `links: []`
 * honest for a homepage reused from 03.
 */
function extractTextLinks(
  text: string,
  baseUrl: string,
): LinkCandidate[] {
  const found: LinkCandidate[] = [];

  const push = (raw: string, anchor: string | null): void => {
    try {
      const url = new URL(raw, baseUrl);

      if (url.protocol === 'http:' || url.protocol === 'https:') {
        found.push({ url: url.href, anchor });
      }
    } catch {
      // A malformed link in the saved text is not a usable next page.
    }
  };

  for (const match of text.matchAll(
    /\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
  )) {
    push(match[2] ?? '', match[1]?.trim() || null);
  }

  for (const match of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    push(match[1] ?? '', null);
  }

  for (const match of text.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) {
    push((match[0] ?? '').replace(/[.,;:]+$/, ''), null);
  }

  return found;
}

/**
 * Deterministic shortlist: same host, depth 1–2, a contact keyword in
 * the URL or the anchor, at most 12 links.
 */
function shortlistLinks(
  candidates: readonly LinkCandidate[],
  domain: string,
  homepageUrl: string,
): ProfilingLink[] {
  const host = bareHost(domain);
  const homepage = normalizedUrl(homepageUrl);
  const seen = new Set<string>();
  const shortlist: ProfilingLink[] = [];

  for (const candidate of candidates) {
    if (shortlist.length >= MAX_LINKS) break;

    let url: URL;

    try {
      url = new URL(candidate.url);
    } catch {
      continue;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (bareHost(url.hostname) !== host) continue;

    const normalized = normalizedUrl(candidate.url);

    if (normalized === homepage || seen.has(normalized)) continue;

    const segments = url.pathname.split('/').filter(Boolean);

    if (segments.length === 0 || segments.length > 2) continue;

    const anchor = candidate.anchor?.trim() || anchorFromUrl(url);
    const kind = linkKind(searchable(`${url.pathname} ${anchor}`));

    if (kind === null) continue;

    seen.add(normalized);
    shortlist.push({
      id: `L${shortlist.length + 1}`,
      url: candidate.url,
      anchor,
      kind,
    });
  }

  return shortlist;
}
