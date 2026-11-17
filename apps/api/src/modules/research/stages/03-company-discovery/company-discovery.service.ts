import { Injectable, Logger } from '@nestjs/common';

import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import {
  type FirecrawlPage,
  mapSite,
  scrapePage,
} from '../../lib/firecrawl.js';
import { llmChat } from '../../lib/llm-chat.js';
import {
  containsName,
  nameWordStems,
  normalizeForMatch,
} from '../../pipeline/name-match.js';
import { stripCodeFence } from '../../lib/strip-code.fense.js';
import type { PageForAssessment } from '../../types.js';
import {
  COMPANY_DISCOVERY_PROMPT,
  COMPANY_DISCOVERY_PROMPT_VERSION,
} from './company-discovery.prompt.js';
import {
  companyDiscoveryAnswerSchema,
  type CompanyDiscoveryAnswer,
} from './company-discovery.schema.js';
import { CONTACT_PAGE_PICKER_PROMPT } from './contact-page-picker.prompt.js';
import { contactPagePickerSchema } from './contact-page-picker.schema.js';
import {
  resolveFileName,
  timestampForFileName,
  writeJsonFile,
} from '../../lib/utils.js';

const PAGE_TEXT_LIMIT = 12_000;
const HOMEPAGE_TEXT_LIMIT = 20_000;
const EXTRA_TEXT_LIMIT = 20_000;
const LINK_LIMIT = 400;
const MAX_EXTRA_PAGES = 2;
const DISCOVERY_CONCURRENCY = 3;
const MAX_OFFERS = 30;
/**
 * Pages handed to one profile call. A big shop can pass a dozen pages through
 * stage 02; the model needs evidence, not the whole catalogue, and every page
 * costs prompt tokens.
 */
const MAX_PAGES_PER_DOMAIN = 2;
/**
 * How close a price must sit to the product's own words to count as an offer of
 * the product. Any supplied page may carry it — a shop can print the price on
 * the homepage — but a price printed far from those words belongs to something
 * else on the page.
 */
const PRICE_WINDOW_CHARS = 1_200;
/** Distinct product-name stems a price window must contain. */
const PRICE_WINDOW_MIN_WORDS = 2;

export type CompanyEmail = {
  value: string;
  sourceUrl: string | null;
};

export type CompanyPerson = {
  name: string | null;
  role: string | null;
  email: string | null;
  sourceUrl: string | null;
};

export type CompanyOffer = {
  price: string;
  currency: string | null;
  unit: string | null;
  sourceUrl: string | null;
};

export type CompanyResult = {
  domain: string;
  name: string | null;
  legalName: string | null;
  companyCode: string | null;
  vatCode: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  emails: CompanyEmail[];
  people: CompanyPerson[];
  offers: CompanyOffer[];
  verdict: 'a' | 'b' | 'none' | 'unclear' | null;
  confidence: 'high' | 'medium' | 'low' | null;
  sources: string[];
  notes: string | null;
  status: 'ok' | 'error';
  error?: string;
};

/**
 * Everything stage 03 needs to know about the run itself.
 *
 * Stage 02 already hands over the filtered pages, so the product context is all
 * that is left: the market (from the request) and the three local names stage 01
 * identified. The English source text is not repeated here — the model works in
 * the market's own commercial vocabulary.
 */
export type DiscoveryContext = {
  targetCountry: string;
  product: {
    productName: string;
    categoryName: string;
    generalCategoryName: string;
  };
};

/** One stage-03 call: the run context plus the pages stage 02 kept. */
export type DiscoveryInput = DiscoveryContext & {
  pages: PageForAssessment[];
};

type AskInput = {
  domain: string;
  pages: PageForAssessment[];
  homepage: FirecrawlPage | null;
  extraPages: FirecrawlPage[];
  links: string[];
  previous: CompanyDiscoveryAnswer | null;
  context: DiscoveryContext;
};

/**
 * Cuts a long page to `limit` characters, keeping the beginning AND the end.
 *
 * Contacts, prices and legal details usually sit in the footer, so a head-only
 * cut silently loses exactly the data this stage exists to collect.
 */
function cap(text: string | null | undefined, limit: number): string {
  const value = (text ?? '').trim();

  if (value.length <= limit) {
    return value;
  }

  const head = Math.floor(limit * 0.65);
  const tail = limit - head;

  return `${value.slice(0, head)}\n…\n${value.slice(-tail)}`;
}

function bareDomain(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

/** True for a URL that is the site root, i.e. the same page as the homepage. */
function isRootUrl(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

/**
 * The pages one domain is judged on: at most `MAX_PAGES_PER_DOMAIN`.
 *
 * Stage 02 hands over every page that passed triage, and a large catalogue can
 * pass a dozen of them. The profile call needs evidence, not the whole range, so
 * pages are deduplicated by grouping key and the ones that actually name the
 * product win: a product page proves more than a longer category page. Ties go
 * to the longer text. Site roots are dropped — the homepage scrape already is
 * that page.
 */
function pickEvidencePages(
  pages: PageForAssessment[],
  productName: string,
  homepageUrl?: string,
): PageForAssessment[] {
  const byUrl = new Map<string, PageForAssessment>();

  for (const page of pages) {
    const key = page.canonicalUrl || page.url;
    const existing = byUrl.get(key);

    if (
      !existing ||
      (page.content ?? '').length > (existing.content ?? '').length
    ) {
      byUrl.set(key, page);
    }
  }

  return [...byUrl.values()]
    .filter((page) => !isRootUrl(page.url) && page.url !== homepageUrl)
    .map((page) => ({
      page,
      // A product page usually carries the product in its title; a category
      // page can still mention it somewhere in the listing, which is why the
      // title match ranks above a text match.
      inTitle: containsName(page.title ?? '', productName),
      inText: containsName(
        `${page.title ?? ''} ${page.content ?? ''}`,
        productName,
      ),
    }))
    .sort(
      (left, right) =>
        Number(right.inTitle) - Number(left.inTitle) ||
        Number(right.inText) - Number(left.inText) ||
        (right.page.content ?? '').length - (left.page.content ?? '').length,
    )
    .slice(0, MAX_PAGES_PER_DOMAIN)
    .map((entry) => entry.page);
}

/** Numeric value of a printed price, or 0 when it cannot be read. */
function priceValue(price: string): number {
  return Number(price.replace(/[\s\u00a0]/g, '').replace(',', '.'));
}

/**
 * True when the price printed at `index` sits close to enough of the product's
 * own words, i.e. when that price belongs to this product and not to something
 * else on the same page.
 */
function nearProductName(
  text: string,
  index: number,
  stems: string[],
): boolean {
  if (stems.length === 0) {
    return true;
  }

  const window = text.slice(
    Math.max(0, index - PRICE_WINDOW_CHARS),
    index + PRICE_WINDOW_CHARS,
  );
  const flat = normalizeForMatch(window).replace(/\s+/g, '');
  const found = new Set(stems.filter((stem) => flat.includes(stem)));
  const needed = Math.min(PRICE_WINDOW_MIN_WORDS, stems.length);

  return found.size >= needed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Stage 03: builds one company profile per good domain from stage 02.
 *
 * One loop iteration = one domain: scrape the homepage, ask the model for the
 * company profile and the a/b verdict, fetch up to two contact pages when
 * contact details are missing, then ask once more to complete the profile.
 * A failing domain is recorded as an error and never stops the loop.
 */
@Injectable()
export class CompanyDiscoveryService {
  private readonly logger = new Logger('CompanyDiscovery');

  async discover(
    input: DiscoveryInput,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<CompanyResult[]> {
    const groups = new Map<string, PageForAssessment[]>();

    for (const page of input.pages) {
      const list = groups.get(page.domain) ?? [];
      list.push(page);
      groups.set(page.domain, list);
    }

    const results: CompanyResult[] = [];
    const entries = [...groups.entries()];
    let index = 0;

    // Bounded concurrency: Firecrawl allows 25 browsers on Standard, but the
    // free plan only 2, and every domain costs a scrape plus an LLM call.
    const worker = async (): Promise<void> => {
      while (index < entries.length) {
        const position = index;
        index += 1;

        const [domain, domainPages] = entries[position];

        await onStage?.(
          `3.1 Discovering companies ${position + 1}/${entries.length} (${domain})`,
        );

        results[position] = await this.discoverDomain(
          domain,
          domainPages,
          input,
        );
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(DISCOVERY_CONCURRENCY, entries.length) },
        () => worker(),
      ),
    );

    await this.writeReport(input, results);

    return results;
  }

  /** One readable file per run, so profiles can be reviewed without the DB. */
  private async writeReport(
    context: DiscoveryContext,
    results: CompanyResult[],
  ): Promise<void> {
    const stamp = timestampForFileName();
    const filePath = resolveFileName(`04-companies-${stamp}`);

    try {
      await writeJsonFile(filePath, {
        promptVersion: COMPANY_DISCOVERY_PROMPT_VERSION,
        createdAt: new Date().toISOString(),
        targetCountry: context.targetCountry,
        product: context.product,
        results,
      });

      this.logger.log(`Company report written to ${filePath}`);
    } catch (error) {
      // The report is a debugging aid: losing it must never fail a real run.
      this.logger.warn(`Company report write failed: ${this.message(error)}`);
    }
  }

  private async discoverDomain(
    domain: string,
    pages: PageForAssessment[],
    context: DiscoveryContext,
  ): Promise<CompanyResult> {
    const sources = new Set<string>(pages.map((page) => page.url));

    let homepage: FirecrawlPage | null = null;

    try {
      homepage = await scrapePage(`https://${domain}/`);
      sources.add(homepage.url);
    } catch (error) {
      this.logger.warn(
        `Homepage scrape failed for ${domain}: ${this.message(error)}`,
      );
    }

    if (!homepage && pages.length === 0) {
      return this.errorResult(domain, 'no page data', [...sources]);
    }

    const evidencePages = pickEvidencePages(
      pages,
      context.product.productName,
      homepage?.url,
    );
    const links = this.usableLinks(homepage?.links ?? []);

    let answer: CompanyDiscoveryAnswer;

    try {
      answer = await this.ask({
        domain,
        pages: evidencePages,
        homepage,
        extraPages: [],
        links,
        previous: null,
        context,
      });
    } catch (error) {
      return this.errorResult(domain, this.message(error), [...sources]);
    }

    const missingEmails = answer.emails.length === 0;
    const missingPeople = this.usablePeople(answer.people).length === 0;
    let extraPages: FirecrawlPage[] = [];

    if (missingEmails || missingPeople) {
      this.logger.log(
        `Company ${domain}: no emails=${missingEmails}, no people=${missingPeople}, looking for contact pages`,
      );

      let candidates = await this.pickContactUrls(links, domain, context);

      if (candidates.length === 0) {
        const mapped = await this.tryMap(domain);

        this.logger.log(
          `Company ${domain}: map returned ${mapped.length} links`,
        );

        if (mapped.length > 0) {
          candidates = await this.pickContactUrls(
            this.usableLinks(mapped),
            domain,
            context,
          );

          if (candidates.length === 0) {
            candidates = this.shallowUrls(mapped, domain, homepage?.url);
          }
        }
      }

      this.logger.log(
        `Company ${domain}: contact pages=${JSON.stringify(candidates)}`,
      );

      for (const url of candidates) {
        try {
          extraPages.push(await scrapePage(url));
          sources.add(url);
        } catch (error) {
          this.logger.warn(
            `Contact page scrape failed for ${url}: ${this.message(error)}`,
          );
        }
      }

      if (extraPages.length > 0) {
        try {
          answer = await this.ask({
            domain,
            pages: evidencePages,
            homepage,
            extraPages,
            links,
            previous: answer,
            context,
          });
        } catch (error) {
          this.logger.warn(
            `Profile completion failed for ${domain}: ${this.message(error)}`,
          );
        }
      }
    }

    this.logger.log(
      `Company ${domain}: ${answer.verdict} (${answer.confidence}), ` +
        `${answer.emails.length} emails, ${answer.people.length} people, ` +
        `${sources.size} sources`,
    );

    // Regex extraction runs after the model so nothing on a fetched page is lost:
    // `mailto:` links carry exact addresses the model may skip.
    const extracted = this.extractEmails([
      ...(homepage ? [{ url: homepage.url, markdown: homepage.markdown }] : []),
      ...extraPages.map((page) => ({ url: page.url, markdown: page.markdown })),
    ]);

    const sourceTexts = new Map<string, string>();

    for (const page of evidencePages) {
      sourceTexts.set(
        page.url,
        [page.content, page.summary, page.highlights.join(' ')]
          .filter(Boolean)
          .join(' '),
      );
    }

    if (homepage) {
      sourceTexts.set(homepage.url, homepage.markdown);
    }

    for (const page of extraPages) {
      sourceTexts.set(page.url, page.markdown);
    }

    // Prices belong to the exact-product companies only, and only when the page
    // prints them next to the product's own words. Both the model's offers and a
    // regex pass over the supplied pages are kept, but an offer is dropped unless
    // its price really appears in the source text, close to the product name.
    const productName = context.product.productName;
    const offers =
      answer.verdict === 'a'
        ? this.uniqueOffers([
            ...this.extractPrices(sourceTexts, productName),
            ...this.validOffers(answer.offers, sourceTexts, productName),
          ])
        : [];

    return {
      domain,
      name: answer.name,
      legalName: answer.legalName,
      companyCode: this.cleanCode(answer.companyCode),
      vatCode: this.cleanCode(answer.vatCode),
      address: answer.address,
      city: answer.city,
      country: answer.country,
      emails: this.uniqueEmails([...extracted, ...answer.emails]),
      people: this.usablePeople(answer.people),
      offers,
      verdict: answer.verdict,
      confidence: answer.confidence,
      sources: [...sources],
      notes: answer.notes,
      status: 'ok',
    };
  }

  private async ask(input: AskInput): Promise<CompanyDiscoveryAnswer> {
    const response = await llmChat(LLM_CONFIG_FLASH, COMPANY_DISCOVERY_PROMPT, {
      targetCountry: input.context.targetCountry,
      product: input.context.product,
      domain: input.domain,
      pages: input.pages.map((page) => ({
        url: page.url,
        title: page.title,
        text: cap(
          page.content ?? page.summary ?? page.highlights.join(' '),
          PAGE_TEXT_LIMIT,
        ),
      })),
      homepage: input.homepage
        ? {
            url: input.homepage.url,
            markdown: cap(input.homepage.markdown, HOMEPAGE_TEXT_LIMIT),
          }
        : null,
      extraPages: input.extraPages.map((page) => ({
        url: page.url,
        markdown: cap(page.markdown, EXTRA_TEXT_LIMIT),
      })),
      links: input.links.slice(0, LINK_LIMIT),
      previous: input.previous
        ? {
            name: input.previous.name,
            legalName: input.previous.legalName,
            companyCode: input.previous.companyCode,
            vatCode: input.previous.vatCode,
            address: input.previous.address,
            city: input.previous.city,
            country: input.previous.country,
            emails: input.previous.emails,
            people: input.previous.people,
            verdict: input.previous.verdict,
            confidence: input.previous.confidence,
          }
        : null,
    });

    const raw = response.choices[0]?.message.content ?? '';

    return companyDiscoveryAnswerSchema.parse(JSON.parse(stripCodeFence(raw)));
  }

  /**
   * Asks the model which supplied URLs look like contact or about pages.
   * Separate from the profile prompt so the choice is not biased by contacts
   * the profile already found.
   */
  private async pickContactUrls(
    links: string[],
    domain: string,
    context: DiscoveryContext,
  ): Promise<string[]> {
    if (links.length === 0) {
      return [];
    }

    try {
      const response = await llmChat(
        LLM_CONFIG_FLASH,
        CONTACT_PAGE_PICKER_PROMPT,
        {
          targetCountry: context.targetCountry,
          domain,
          links: links.slice(0, LINK_LIMIT),
        },
      );

      const raw = response.choices[0]?.message.content ?? '';
      const parsed = contactPagePickerSchema.parse(
        JSON.parse(stripCodeFence(raw)),
      );

      return this.sameDomainUrls(parsed.urls, domain).slice(0, MAX_EXTRA_PAGES);
    } catch (error) {
      this.logger.warn(
        `Contact page pick failed for ${domain}: ${this.message(error)}`,
      );
      return [];
    }
  }

  /**
   * Last resort when the picker finds no contact page: try the shallowest
   * same-domain pages, where contact and about pages usually live. A depth-0
   * URL with a query string counts, because many shops keep contacts at
   * `/?route=information/contact`.
   */
  private shallowUrls(
    urls: string[],
    domain: string,
    excludeUrl?: string,
  ): string[] {
    return this.sameDomainUrls(urls, domain)
      .filter((url) => {
        if (excludeUrl && url === excludeUrl) {
          return false;
        }

        try {
          const parsed = new URL(url);
          const depth = parsed.pathname.split('/').filter(Boolean).length;

          return depth === 1 || (depth === 0 && parsed.search.length > 1);
        } catch {
          return false;
        }
      })
      .slice(0, MAX_EXTRA_PAGES);
  }

  private async tryMap(domain: string): Promise<string[]> {
    try {
      return await mapSite(`https://${domain}/`, 500);
    } catch (error) {
      this.logger.warn(`Map failed for ${domain}: ${this.message(error)}`);
      return [];
    }
  }

  /**
   * Drops non-page URLs (sitemaps, feeds, images, downloads) so the model is
   * only offered real pages to pick a contact page from, and puts shallow URLs
   * first: a contact page is almost always one or two segments deep.
   */
  private usableLinks(links: string[]): string[] {
    const usable = links.filter((link) => {
      try {
        const url = new URL(link);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return false;
        }

        if (
          /\.(xml|pdf|jpe?g|png|gif|svg|webp|css|js|zip|gz|ico)$/i.test(
            url.pathname,
          )
        ) {
          return false;
        }

        return !/sitemap|robots/i.test(url.pathname);
      } catch {
        return false;
      }
    });

    const depth = (link: string): number => {
      try {
        return new URL(link).pathname.split('/').filter(Boolean).length;
      } catch {
        return 99;
      }
    };

    return [...new Set(usable)].sort(
      (left, right) => depth(left) - depth(right) || left.length - right.length,
    );
  }

  private sameDomainUrls(urls: string[], domain: string): string[] {
    const target = bareDomain(domain);

    return [
      ...new Set(
        this.usableLinks(urls).filter((url) => {
          try {
            const host = bareDomain(new URL(url).hostname);
            return host === target || host.endsWith(`.${target}`);
          } catch {
            return false;
          }
        }),
      ),
    ];
  }

  /**
   * Pulls exact emails out of fetched pages.
   *
   * `mailto:` links in the Markdown are precise, so they are read directly; a
   * plain-email regex catches addresses written as text.
   */
  private extractEmails(
    pages: { url: string; markdown: string }[],
  ): CompanyEmail[] {
    const emails: CompanyEmail[] = [];

    for (const page of pages) {
      for (const match of page.markdown.matchAll(
        /\]\(mailto:\s*([^)\s]+)[^)]*\)/gi,
      )) {
        const value = decodeURIComponent(match[1]).trim();
        if (value.includes('@')) {
          emails.push({ value, sourceUrl: page.url });
        }
      }

      for (const match of page.markdown.matchAll(
        /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
      )) {
        emails.push({ value: match[0], sourceUrl: page.url });
      }
    }

    return this.uniqueEmails(emails);
  }

  /**
   * Finds prices written on the supplied pages.
   *
   * A price counts only next to a currency symbol or code, so ID numbers, phone
   * numbers and dimensions are not mistaken for prices, and only when it sits
   * close to the product's own words, so a shop page full of other prices yields
   * nothing. The unit is picked up when it follows the price (`/m²`, `/vnt`).
   */
  private extractPrices(
    sources: Map<string, string>,
    productName: string,
  ): CompanyOffer[] {
    const currency = '(?:€|EUR|\\$|USD|zł|PLN|Ft|HUF|Kč|CZK|£|GBP|kr|SEK|NOK)';
    const number = '\\d{1,3}(?:[\\s\\u00a0]?\\d{3})*(?:[.,]\\d{1,2})?';
    const pattern = new RegExp(
      `(?:(${currency})\\s*(${number})|(${number})\\s*(${currency}))(?:\\s*(?:\\/|per|už)\\s*(m2|m²|m3|m³|m|vnt\\.?|pcs|piece|kg))?`,
      'gi',
    );
    const stems = nameWordStems(productName);

    const offers: CompanyOffer[] = [];

    for (const [sourceUrl, text] of sources) {
      for (const match of text.matchAll(pattern)) {
        const price = (match[2] ?? match[3] ?? '').trim();
        const foundCurrency = (match[1] ?? match[4] ?? '').trim();
        const unit = (match[5] ?? '').trim();

        if (!price || priceValue(price) === 0) {
          continue;
        }

        if (!nearProductName(text, match.index ?? 0, stems)) {
          continue;
        }

        offers.push({
          price,
          currency: foundCurrency || null,
          unit: unit || null,
          sourceUrl,
        });
      }
    }

    return offers;
  }

  /**
   * Keeps only model offers whose price is present in the source text and, at
   * that place, close enough to the product's own words.
   */
  private validOffers(
    offers: CompanyOffer[],
    sources: Map<string, string>,
    productName: string,
  ): CompanyOffer[] {
    const squash = (value: string): string =>
      value.replace(/[\s\u00a0]/g, '').toLowerCase();
    const stems = nameWordStems(productName);
    const allText = [...sources.values()].join(' ');

    return offers.filter((offer) => {
      if (!offer.price.trim() || priceValue(offer.price) === 0) {
        return false;
      }

      const text = offer.sourceUrl
        ? (sources.get(offer.sourceUrl) ?? allText)
        : allText;

      if (!squash(text).includes(squash(offer.price))) {
        return false;
      }

      const pattern = new RegExp(escapeRegExp(offer.price), 'gi');

      for (const match of text.matchAll(pattern)) {
        if (nearProductName(text, match.index ?? 0, stems)) {
          return true;
        }
      }

      return false;
    });
  }

  private uniqueOffers(offers: CompanyOffer[]): CompanyOffer[] {
    const seen = new Set<string>();
    const result: CompanyOffer[] = [];

    for (const offer of offers) {
      const key = [
        offer.price.replace(/[\s\u00a0]/g, ''),
        offer.currency ?? '',
        offer.unit ?? '',
        offer.sourceUrl ?? '',
      ]
        .join('|')
        .toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(offer);
    }

    return result.slice(0, MAX_OFFERS);
  }

  /**
   * Strips the local label from a registration or VAT number.
   *
   * Pages print these with their own wording and punctuation, e.g.
   * `Įm. k. 302311031`, `PVM k. LT100004581810`, `ĮK 125161681` or
   * `PVM LT251616811`. The code is the last code-like run in the value, with
   * spaces and dashes removed, so no label vocabulary per country is needed.
   */
  private cleanCode(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const matches = value.match(/(?:[A-Z]{2}\s?)?\d[\d\s-]{4,}\d/gi);

    if (!matches || matches.length === 0) {
      return null;
    }

    const code = matches[matches.length - 1]
      .replace(/[\s-]/g, '')
      .toUpperCase();

    return (code.match(/\d/g) ?? []).length >= 5 ? code : null;
  }

  /** People with at least one usable fact; a bare role is not a person. */
  private usablePeople(people: CompanyPerson[]): CompanyPerson[] {
    return people.filter((person) =>
      Boolean((person.name ?? '').trim() || (person.email ?? '').trim()),
    );
  }

  private uniqueEmails(emails: CompanyEmail[]): CompanyEmail[] {
    const seen = new Set<string>();
    const result: CompanyEmail[] = [];

    for (const email of emails) {
      const value = this.cleanEmail(email.value);

      if (!value) {
        continue;
      }

      const key = value.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({ value, sourceUrl: email.sourceUrl });
    }

    return this.dropTruncatedEmails(result);
  }

  /**
   * Drops addresses that are a cut-off copy of another address.
   *
   * A page that breaks a line inside an address leaves the tail behind, e.g.
   * `davimai@marwood.lt` next to `pardavimai@marwood.lt`. Only a short missing
   * prefix counts, so real addresses such as `info@` and `salesinfo@` both stay.
   */
  private dropTruncatedEmails(emails: CompanyEmail[]): CompanyEmail[] {
    return emails.filter(
      (email) =>
        !emails.some(
          (other) =>
            other !== email &&
            other.value.toLowerCase().endsWith(email.value.toLowerCase()) &&
            other.value.length - email.value.length <= 4,
        ),
    );
  }

  /** Decodes a URL-encoded address and drops anything that is not an email. */
  private cleanEmail(value: string): string {
    let result = value.trim();

    if (result.includes('%')) {
      try {
        result = decodeURIComponent(result).trim();
      } catch {
        // keep the raw value when it is not valid percent-encoding
      }
    }

    result = result
      .replace(/^mailto:\s*/i, '')
      .replace(/^\/\//, '')
      .trim();

    return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(result) ? result : '';
  }

  private errorResult(
    domain: string,
    error: string,
    sources: string[],
  ): CompanyResult {
    this.logger.warn(`Company ${domain} failed: ${error}`);

    return {
      domain,
      name: null,
      legalName: null,
      companyCode: null,
      vatCode: null,
      address: null,
      city: null,
      country: null,
      emails: [],
      people: [],
      offers: [],
      verdict: null,
      confidence: null,
      sources,
      notes: null,
      status: 'error',
      error,
    };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export { COMPANY_DISCOVERY_PROMPT_VERSION };
