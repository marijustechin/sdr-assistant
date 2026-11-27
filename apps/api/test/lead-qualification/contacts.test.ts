import { describe, expect, it } from 'vitest';

import {
  ContactDiscoveryService,
  SafePageFetcher,
  type DiscoveryPageFetcher,
  type DiscoverySearchProvider,
} from '../../src/modules/lead-qualification/lead-qualification.discovery.js';
import {
  dedupeEmails,
  dedupePhones,
  extractEmails,
  extractPhones,
  isAcceptableEmail,
  normaliseEmail,
} from '../../src/modules/lead-qualification/lead-qualification.contacts.js';
import { DEFAULT_LEAD_QUALIFICATION_LIMITS } from '../../src/modules/lead-qualification/lead-qualification.constants.js';
import { discoveryResult, sourceCompany, websiteCheck } from './helpers.js';

class FakeFetcher implements DiscoveryPageFetcher {
  calls = 0;
  constructor(private readonly text: string | null) {}

  async fetch(url: string): Promise<{ url: string; text: string }> {
    this.calls += 1;
    return { url, text: this.text ?? '' };
  }
}

class FakeSearch implements DiscoverySearchProvider {
  calls = 0;
  async search(): Promise<Array<{ url: string }>> {
    this.calls += 1;
    return [];
  }
}

describe('SDR-007A contact normalisation and discovery', () => {
  it('accepts source-backed business emails and rejects placeholders', () => {
    expect(normaliseEmail('info@alpha.test')).toBe('info@alpha.test');
    expect(normaliseEmail('your@example.com')).toBeNull();
    expect(normaliseEmail('example@alpha.test')).toBeNull();

    const company = sourceCompany();
    const emails = extractEmails(
      'Contact info@alpha.test or sales@other.test. Placeholder your@example.com.',
      'https://alpha.test/contact',
      company,
      'Alpha UAB contact page.',
    );
    expect(emails.map((email) => email.value)).toEqual(['info@alpha.test']);
    expect(
      isAcceptableEmail(
        'sales@other.test',
        'https://alpha.test/contact',
        company,
        'Alpha UAB contact page.',
      ),
    ).toBe(false);
  });

  it('deduplicates within one company while preserving role and source evidence', () => {
    const emails = dedupeEmails([
      {
        value: 'info@alpha.test',
        role: 'sales',
        sourceUrl: 'https://alpha.test/contact',
        discoveredBy: 'contact-page',
      },
      {
        value: 'INFO@alpha.test',
        role: 'general',
        sourceUrl: 'https://alpha.test/imprint',
        discoveredBy: 'imprint',
      },
    ]);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.role).toBe('sales');
    expect(emails[0]?.sourceUrl).toBe('https://alpha.test/contact');

    const phones = dedupePhones([
      {
        value: '+37060000000',
        normalised: '+37060000000',
        role: 'sales',
        sourceUrl: 'https://alpha.test/contact',
        discoveredBy: 'contact-page',
      },
      {
        value: '+370 600 00000',
        normalised: '+37060000000',
        role: 'general',
        sourceUrl: 'https://alpha.test/imprint',
        discoveredBy: 'imprint',
      },
    ]);
    expect(phones).toHaveLength(1);
    expect(phones[0]?.role).toBe('sales');
  });

  it('does not assign another listing contact from a multi-company directory page', () => {
    const company = sourceCompany({ emails: [] });
    const text =
      'Alpha UAB contact info@alpha.test phone +37060000001 ' +
      'x'.repeat(700) +
      ' Beta UAB contact info@beta.test phone +37060000002';
    const emails = extractEmails(
      text,
      'https://directory.test/listing',
      company,
      text,
    );
    const phones = extractPhones(
      text,
      'https://directory.test/listing',
      company,
      text,
    );
    expect(emails.map((email) => email.value)).toEqual(['info@alpha.test']);
    expect(phones.map((phone) => phone.normalised)).toEqual([
      '+37060000001',
    ]);
  });

  it('extracts and deduplicates international telephone values', () => {
    const phones = extractPhones(
      'Call +370 600 00000 or +370 600 00000.',
      'https://alpha.test/contact',
      sourceCompany(),
    );
    expect(phones).toHaveLength(1);
    expect(phones[0]?.normalised).toBe('+37060000000');
  });

  it('finds a missing email through a bounded contact page', async () => {
    const company = sourceCompany({ emails: [] });
    const fetcher = new FakeFetcher(
      'Alpha UAB contact info@alpha.test phone +37060000000.',
    );
    const search = new FakeSearch();
    const service = new ContactDiscoveryService(
      fetcher,
      search,
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const result = await service.discover({
      company,
      website: websiteCheck({ bodyText: 'Welcome to Alpha UAB.' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(result.emails.map((email) => email.value)).toContain('info@alpha.test');
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0]?.sourceUrl).toContain('alpha.test');
    expect(fetcher.calls).toBeGreaterThan(0);
  });

  it('does not invent an email when bounded discovery finds none', async () => {
    const company = sourceCompany({ emails: [] });
    const fetcher = new FakeFetcher('No contact address here.');
    const search = new FakeSearch();
    const service = new ContactDiscoveryService(
      fetcher,
      search,
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const result = await service.discover({
      company,
      website: websiteCheck({ bodyText: 'Welcome.' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(result.emails).toEqual([]);
    expect(result.searches).toBe(2);
  });

  it('prioritizes discovered contact pages over product source pages', async () => {
    class RecordingFetcher implements DiscoveryPageFetcher {
      urls: string[] = [];
      async fetch(url: string): Promise<{ url: string; text: string }> {
        this.urls.push(url);
        return { url, text: 'No usable contact.' };
      }
    }
    const company = sourceCompany({
      emails: [],
      sources: [
        'https://alpha.test/product',
        'https://alpha.test/contact',
      ],
    });
    const fetcher = new RecordingFetcher();
    const service = new ContactDiscoveryService(
      fetcher,
      new FakeSearch(),
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    await service.discover({
      company,
      website: websiteCheck({ bodyText: 'Welcome.' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(fetcher.urls[0]).toContain('/contact');
  });

  it('accepts a source-backed contact from a public business directory', async () => {
    class DirectoryFetcher implements DiscoveryPageFetcher {
      async fetch(url: string): Promise<{ url: string; text: string }> {
        if (url.includes('directory.test')) {
          return {
            url,
            text: 'Alpha UAB listed contact info@alpha.test',
          };
        }
        return { url, text: 'No contact here.' };
      }
    }
    class DirectorySearch implements DiscoverySearchProvider {
      async search(): Promise<Array<{ url: string }>> {
        return [{ url: 'https://directory.test/company-alpha' }];
      }
    }
    const company = sourceCompany({ emails: [], sources: [] });
    const service = new ContactDiscoveryService(
      new DirectoryFetcher(),
      new DirectorySearch(),
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const result = await service.discover({
      company,
      website: websiteCheck({ bodyText: '' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(result.emails.map((email) => email.value)).toContain('info@alpha.test');
    expect(result.emails[0]?.discoveredBy).toBe('directory');
    expect(result.emails[0]?.sourceUrl).toContain('directory.test');
  });

  it('counts unsuccessful fetches against the bounded page budget', async () => {
    class FailingFetcher implements DiscoveryPageFetcher {
      calls = 0;
      async fetch(url: string): Promise<{ url: string; text: string }> {
        this.calls += 1;
        throw new Error(`synthetic failure for ${url}`);
      }
    }
    const company = sourceCompany({ emails: [], sources: [] });
    const fetcher = new FailingFetcher();
    const service = new ContactDiscoveryService(
      fetcher,
      new FakeSearch(),
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const result = await service.discover({
      company,
      website: websiteCheck({ bodyText: '' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(fetcher.calls).toBe(DEFAULT_LEAD_QUALIFICATION_LIMITS.discoveryPages);
    expect(result.fetches).toBeGreaterThanOrEqual(
      DEFAULT_LEAD_QUALIFICATION_LIMITS.discoveryPages,
    );
  });

  it('stops discovery when existing email and source-backed geography are sufficient', async () => {
    class NoFetch implements DiscoveryPageFetcher {
      calls = 0;
      async fetch(url: string): Promise<{ url: string; text: string }> {
        this.calls += 1;
        return { url, text: '' };
      }
    }
    const company = sourceCompany();
    const fetcher = new NoFetch();
    const service = new ContactDiscoveryService(
      fetcher,
      new FakeSearch(),
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const result = await service.discover({
      company,
      website: websiteCheck({
        bodyText: 'Test Street 1, Vilnius, Lithuania. Contact us.',
      }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: false,
      needGeography: true,
    });
    expect(result.localAddressEvidence.length).toBeGreaterThan(0);
    expect(fetcher.calls).toBe(0);
  });

  it('uses the scraper fallback only when evidence is still missing', async () => {
    class NoContactFetcher implements DiscoveryPageFetcher {
      async fetch(url: string): Promise<{ url: string; text: string }> {
        return { url, text: 'No contact details.' };
      }
    }
    class Scraper {
      calls = 0;
      async scrape(url: string): Promise<{ url: string; text: string }> {
        this.calls += 1;
        return {
          url,
          text: 'Alpha UAB contact info@alpha.test',
        };
      }
    }
    const scraper = new Scraper();
    const service = new ContactDiscoveryService(
      new NoContactFetcher(),
      new FakeSearch(),
      scraper,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const company = sourceCompany({ emails: [], sources: [] });
    const result = await service.discover({
      company,
      website: websiteCheck({ bodyText: 'Welcome.' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(scraper.calls).toBe(1);
    expect(result.emails.map((email) => email.value)).toContain('info@alpha.test');
  });

  it('never uses a non-success HTTP response as contact evidence', async () => {
    const fetcher = new SafePageFetcher({
      request: async () => ({
        url: 'https://alpha.test/',
        status: 404,
        headers: {},
        body: 'info@alpha.test',
        truncated: false,
        redirects: 0,
        https: true,
        certificateValid: true,
      }),
    } as never);
    await expect(fetcher.fetch('https://alpha.test/')).rejects.toThrowError();
  });

  it('keeps discovery evidence bounded and source-tagged', async () => {
    const company = sourceCompany({ emails: [] });
    const service = new ContactDiscoveryService(
      new FakeFetcher('Alpha UAB info@alpha.test'),
      new FakeSearch(),
      null,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const result = await service.discover({
      company,
      website: websiteCheck({ bodyText: 'Alpha UAB' }),
      targetCountry: 'Lithuania',
      targetCountryCode: 'LT',
      needEmail: true,
      needGeography: false,
    });
    expect(result.evidence.length).toBeLessThanOrEqual(
      DEFAULT_LEAD_QUALIFICATION_LIMITS.maxEvidencePerResult,
    );
    expect(result.emails[0]?.sourceUrl).not.toBeNull();
    expect(discoveryResult().emails).toEqual([]);
  });
});
