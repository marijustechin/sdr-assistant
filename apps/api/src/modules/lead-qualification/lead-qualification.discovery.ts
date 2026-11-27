import {
  dedupeEmails,
  dedupePhones,
  extractPhones,
  extractEmails,
  isSameRegistrableDomain,
  sourceEmailContacts,
  sourcePhoneContacts,
} from './lead-qualification.contacts.js';
import {
  buildGeographySignals,
  evaluateGeography,
  extractAddressEvidence,
  extractCountryCodes,
} from './lead-qualification.geography.js';
import { scrapePage } from '../research/lib/firecrawl.js';
import { searchExa } from '../research/lib/exa-search.js';
import {
  SafeHttpClient,
  SafeHttpError,
  assertSafePublicUrl,
} from './lead-qualification.http.js';
import { DEFAULT_LEAD_QUALIFICATION_LIMITS } from './lead-qualification.constants.js';
import {
  RunWideError,
  type ContactDiscoverySource,
  type DiscoveryPage,
  type DiscoveryResult,
  type EmailContact,
  type EvidenceRef,
  type LeadQualificationLimits,
  type PhoneContact,
  type SourceCompany,
  type WebsiteCheck,
} from './lead-qualification.types.js';

export interface DiscoveryPageFetcher {
  fetch(url: string): Promise<DiscoveryPage>;
}

export interface DiscoverySearchProvider {
  search(
    query: string,
    resultsPerQuery: number,
    country: string,
  ): Promise<Array<{ url: string }>>;
}

export interface DiscoveryScraper {
  scrape(url: string): Promise<DiscoveryPage>;
}

export type DiscoverySearchLimiter = {
  run<T>(operation: () => Promise<T>): Promise<T>;
};

export type DiscoveryInput = {
  company: SourceCompany;
  searchLimiter?: DiscoverySearchLimiter;
  website: WebsiteCheck;
  targetCountry: string;
  targetCountryCode: string | null;
  needEmail: boolean;
  needGeography: boolean;
};

function pathKind(url: string): ContactDiscoverySource {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();

  if (/(imprint|impressum|legal|juridical|rekvizit)/.test(path)) return 'imprint';
  if (/(about|apie|company|imone)/.test(path)) return 'about';
  if (/(contact|kontakt|susisiek|sales|wholesale|pardav)/.test(path)) {
    return 'contact-page';
  }
  return 'contact-page';
}

function pageEvidence(url: string): EvidenceRef[] {
  return [
    {
      url,
      kind: 'website',
      quote: null,
      source: 'http',
      observedAt: new Date().toISOString(),
    },
  ];
}

function pageLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const pattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const url = new URL(match[1] ?? '', baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        links.add(url.toString());
      }
    } catch {
      // Ignore malformed anchors.
    }
  }

  return [...links];
}

const CONTACT_LINK = new RegExp(
  '(contact|kontakt|kontaktai|kontakty|contacto|contact-us|susisiek|' +
    'imprint|impressum|legal|juridical|rekvizit|about|apie|company|imone|' +
    'sales|wholesale|pardav|commercial|purchas|procure)',
  'i',
);

function linkRank(url: string): number {
  const kind = pathKind(url);
  return kind === 'contact-page' ? 0 : kind === 'imprint' ? 1 : kind === 'about' ? 2 : 3;
}

function isDirectoryLike(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(directory|b2b|yellow|kompass|europages|cylex|hotfrog|infobel|imones|rekvizitai|118)/.test(
      host,
    );
  } catch {
    return false;
  }
}

function isAllowedEvidenceDestination(
  url: string,
  company: SourceCompany,
  allowDirectory: boolean,
): boolean {
  return (
    isSameRegistrableDomain(url, company) ||
    (allowDirectory && isDirectoryLike(url))
  );
}

function isSearchCandidate(url: string, company: SourceCompany): boolean {
  return isSameRegistrableDomain(url, company) || isDirectoryLike(url);
}

function hasSufficient(
  input: DiscoveryInput,
  existingEmailCount: number,
  emails: EmailContact[],
  localAddressEvidence: EvidenceRef[],
  foreignAddressEvidence: EvidenceRef[],
  localBranchEvidence: EvidenceRef[],
  geoReady: boolean,
): boolean {
  const emailReady = !input.needEmail || existingEmailCount > 0 || emails.length > 0;
  const geographyReady =
    !input.needGeography ||
    geoReady;
  return emailReady && geographyReady;
}

export class ContactDiscoveryService {
  constructor(
    private readonly fetcher: DiscoveryPageFetcher,
    private readonly search: DiscoverySearchProvider,
    private readonly scraper: DiscoveryScraper | null = null,
    private readonly limits: LeadQualificationLimits = DEFAULT_LEAD_QUALIFICATION_LIMITS,
  ) {}

  async discover(input: DiscoveryInput): Promise<DiscoveryResult> {
    const { company, website } = input;
    const existingEmails = sourceEmailContacts(company);
    const existingPhones = sourcePhoneContacts(company);
    const pages: DiscoveryPage[] = [];
    const emails: EmailContact[] = [];
    const phones: PhoneContact[] = [];
    const evidence: EvidenceRef[] = [];
    const localAddressEvidence: EvidenceRef[] = [];
    const foreignAddressEvidence: EvidenceRef[] = [];
    const foreignAddressCountries = new Set<string>();
    const localBranchEvidence: EvidenceRef[] = [];
    const seenUrls = new Set<string>();
    let fetches = 0;
    let searches = 0;
    let searchFetches = 0;
    let technicalFailure = false;
    let limitReached = false;
    let successfulFetches = 0;
    let geoReady = !input.needGeography;

    const addPage = (page: DiscoveryPage, allowDirectory = false): void => {
      if (
        seenUrls.has(page.url) ||
        !isAllowedEvidenceDestination(page.url, company, allowDirectory)
      ) {
        return;
      }
      seenUrls.add(page.url);
      const controlled = isSameRegistrableDomain(page.url, company);
      if (controlled) {
        pages.push(page);
        evidence.push(...pageEvidence(page.url));
      }
      const kind = !isSameRegistrableDomain(page.url, company) && isDirectoryLike(page.url)
        ? 'directory'
        : pathKind(page.url);
      for (const email of extractEmails(page.text, page.url, company, page.text)) {
        emails.push({ ...email, discoveredBy: kind });
      }
      for (const phone of extractPhones(page.text, page.url, company, page.text)) {
        phones.push({ ...phone, discoveredBy: kind });
      }
      if (controlled) {
        const address = extractAddressEvidence(
          page.url,
          page.text,
          company,
          input.targetCountryCode,
        );
        localAddressEvidence.push(...address.local);
        foreignAddressEvidence.push(...address.foreign);
        for (const country of address.foreignCountries) foreignAddressCountries.add(country);
        evidence.push(...address.local, ...address.foreign);
      }
      refreshGeo();
    };

    const refreshGeo = (): void => {
      if (!input.needGeography) {
        geoReady = true;
        return;
      }
      const signals = buildGeographySignals(
        company,
        input.targetCountryCode,
      );
      const check = evaluateGeography(
        {
          ...signals,
          localAddressEvidence,
          foreignAddressEvidence,
          foreignAddressCountries: [...foreignAddressCountries],
          phones: [
            ...signals.phones,
            ...phones
              .filter((phone) => phone.sourceUrl !== null)
              .map((phone) => ({
                normalised: phone.normalised,
                sourceUrl: phone.sourceUrl,
              })),
          ],
          discoveryAttempted: true,
          discoveryTechnicalFailure: false,
        },
        input.targetCountryCode,
      );
      geoReady =
        check.status === 'PASS' ||
        (check.status === 'FAIL' && check.reason === 'COUNTRY_MISMATCH');
    };
    if (website.bodyText.trim().length > 0) {
      addPage({
        url: website.finalUrl ?? `https://${company.domain}/`,
        text: website.bodyText,
      });
    }

    const discoveredLinks = pageLinks(
      website.bodyText,
      website.finalUrl ?? `https://${company.domain}/`,
    )
      .filter((url) => isSameRegistrableDomain(url, company) && CONTACT_LINK.test(url))
      .sort((left, right) => linkRank(left) - linkRank(right));
    const sourceLinks = company.sources.filter((url) =>
      isSameRegistrableDomain(url, company),
    );
    const contactSourceLinks = sourceLinks.filter((url) => CONTACT_LINK.test(url));
    const otherSourceLinks = sourceLinks.filter((url) => !CONTACT_LINK.test(url));
    const candidates = new Set<string>();
    for (const url of discoveredLinks) candidates.add(url);
    for (const url of contactSourceLinks) candidates.add(url);
    for (const path of [
      '/contact',
      '/kontakt',
      '/kontaktai',
      '/imprint',
      '/impressum',
      '/legal',
      '/about',
      '/apie-mus',
      '/sales',
      '/wholesale',
    ]) {
      try {
        candidates.add(new URL(path, `https://${company.domain}/`).toString());
      } catch {
        // Ignore an invalid profile domain.
      }
    }
    for (const url of otherSourceLinks) candidates.add(url);

    const pageBudget = Math.max(1, this.limits.discoveryPages);
    for (const url of candidates) {
      if (
        hasSufficient(
          input,
          existingEmails.length,
          emails,
          localAddressEvidence,
          foreignAddressEvidence,
          localBranchEvidence,
          geoReady,
        )
      ) {
        break;
      }
      if (fetches >= pageBudget) {
        limitReached = true;
        break;
      }
      if (seenUrls.has(url)) continue;
      fetches += 1;
      try {
        const page = await this.fetcher.fetch(url);
        successfulFetches += 1;
        addPage(page);
      } catch {
        // An unsuccessful request still consumes the bounded attempt budget.
      }
    }

    const missingEmail =
      input.needEmail && existingEmails.length === 0 && emails.length === 0;
    const missingGeography = input.needGeography && !geoReady;

    if (missingEmail || missingGeography) {
      const name = company.name ?? company.domain;
      const queries = [
        `${name} ${input.targetCountry} contact email`,
        `${name} ${company.domain} kontaktai kontakt`,
      ].slice(0, this.limits.discoverySearchQueries);

      for (const query of queries) {
        if (
          hasSufficient(
            input,
            existingEmails.length,
            emails,
            localAddressEvidence,
            foreignAddressEvidence,
            localBranchEvidence,
            geoReady,
          ) ||
          searches >= this.limits.discoverySearchQueries
        ) {
          break;
        }
        try {
          searches += 1;
          const results = input.searchLimiter
            ? await input.searchLimiter.run(() =>
                this.search.search(
                  query,
                  this.limits.discoverySearchResults,
                  input.targetCountry,
                ),
              )
            : await this.search.search(
                query,
                this.limits.discoverySearchResults,
                input.targetCountry,
              );

          for (const result of results) {
            if (
              hasSufficient(
                input,
                existingEmails.length,
                emails,
                localAddressEvidence,
                foreignAddressEvidence,
                localBranchEvidence,
                geoReady,
              )
            ) {
              break;
            }
            if (searchFetches >= this.limits.discoveryFetchedSearchResults) {
              limitReached = true;
              break;
            }
            if (!isSearchCandidate(result.url, company) || seenUrls.has(result.url)) {
              continue;
            }
            searchFetches += 1;
            fetches += 1;
            try {
              const page = await this.fetcher.fetch(result.url);
              successfulFetches += 1;
              addPage(page, true);
            } catch {
              // A search result fetch failure consumes its own bounded slot.
            }
          }
        } catch (error) {
          if (error instanceof RunWideError) throw error;
          technicalFailure = true;
        }
      }
    }

    if (
      this.scraper !== null &&
      this.limits.discoveryFirecrawlPages > 0 &&
      (missingEmail || missingGeography) &&
      !hasSufficient(
        input,
        existingEmails.length,
        emails,
        localAddressEvidence,
        foreignAddressEvidence,
        localBranchEvidence,
        geoReady,
      )
    ) {
      const fallbackUrl = [...candidates].find(
        (url) => !seenUrls.has(url) && isSameRegistrableDomain(url, company),
      );
      if (fallbackUrl !== undefined) {
        try {
          assertSafePublicUrl(fallbackUrl);
          fetches += 1;
          const page = await this.scraper.scrape(fallbackUrl);
          successfulFetches += 1;
          addPage(page);
        } catch (error) {
          if (error instanceof RunWideError) throw error;
          technicalFailure = true;
        }
      }
    }

    const countryCodes = [
      ...new Set(pages.flatMap((page) => extractCountryCodes(page.text))),
    ].sort();

    return {
      emails: dedupeEmails(emails),
      phones: dedupePhones(phones),
      countryCodes,
      localAddressEvidence: dedupeEvidence(localAddressEvidence),
      foreignAddressEvidence: dedupeEvidence(foreignAddressEvidence),
      foreignAddressCountries: [...foreignAddressCountries].sort(),
      localBranchEvidence: [],
      pages,
      evidence: dedupeEvidence(evidence).slice(0, this.limits.maxEvidencePerResult),
      fetches,
      searches,
      attemptedFetches: fetches,
      successfulFetches,
      technicalFailure,
      limitReached,
    };
  }
}

function dedupeEvidence(evidence: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.url}:${item.kind}:${item.quote ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class SafePageFetcher implements DiscoveryPageFetcher {
  constructor(private readonly client: SafeHttpClient) {}

  async fetch(url: string): Promise<DiscoveryPage> {
    const response = await this.client.request(url);
    if (response.status < 200 || response.status >= 300) {
      throw new SafeHttpError(
        'NETWORK',
        `Non-success HTTP status ${response.status} on ${response.url}`,
        false,
      );
    }
    return { url: response.url, text: response.body };
  }
}

export class ExaSearchProvider implements DiscoverySearchProvider {
  async search(
    query: string,
    resultsPerQuery: number,
    country: string,
  ): Promise<Array<{ url: string }>> {
    try {
      const result = await searchExa(query, resultsPerQuery, country);
      return result.results.map((item) => ({ url: item.url }));
    } catch (error) {
      if (isRunWideProviderFailure(error)) {
        throw new RunWideError('SEARCH_PROVIDER_OUTAGE', 'Search provider failed for the run.');
      }
      throw error;
    }
  }
}

export class FirecrawlScraper implements DiscoveryScraper {
  async scrape(url: string): Promise<DiscoveryPage> {
    try {
      const page = await scrapePage(url);
      return { url: page.url, text: page.markdown };
    } catch (error) {
      if (isRunWideProviderFailure(error)) {
        throw new RunWideError('SCRAPE_PROVIDER_OUTAGE', 'Scrape provider failed for the run.');
      }
      throw error;
    }
  }
}

function isRunWideProviderFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = error.message.match(/\b(401|402|403|429|500|502|503|504)\b/);
  return match !== null;
}
