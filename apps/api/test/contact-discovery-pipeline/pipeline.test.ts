import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { extractContactCandidates } from '../../src/modules/contact-discovery/contact-discovery.extractor.js';
import {
  ContactDiscoveryPipeline,
  consolidateContactEvidence,
} from '../../src/modules/contact-discovery-pipeline/contact-discovery-pipeline.js';
import type {
  CompanyContactEvidence,
  ContactDiscoveryPorts,
  FetchedContactPage,
} from '../../src/modules/contact-discovery-pipeline/contact-discovery-pipeline.types.js';
import { ContactDiscoveryRuntime } from '../../src/modules/contact-discovery-pipeline/contact-discovery.runtime.js';
import type { SourceCompany } from '../../src/modules/lead-qualification/lead-qualification.types.js';
import {
  FakeStore,
  acceptedDraft,
  researchRecord,
  sourceCompany,
} from '../lead-qualification/helpers.js';

const contactRoot = process.env.SDR007A_REFERENCE_ROOT;
const exaRoot = process.env.SDR007A_EXA_REFERENCE;
const hasReference = Boolean(contactRoot && exaRoot);

function page(
  html: string,
  url: string,
  extra: Partial<FetchedContactPage> = {},
): FetchedContactPage {
  return { url, status: 200, body: html, redirects: 0, error: null, ...extra };
}

function evidenceFromReference(): CompanyContactEvidence[] {
  if (!contactRoot || !exaRoot) return [];
  const previous = JSON.parse(
    readFileSync(join(contactRoot, 'result.json'), 'utf8'),
  ) as {
    companies: Array<{
      domain: string;
      companyName: string | null;
      homepage: {
        fetchedUrl: string | null;
        httpStatus: number | null;
        fetchError: string | null;
        original: CompanyContactEvidence['original'];
        candidates: Record<string, unknown[]>;
      };
      contactPages: Array<{
        url: string;
        httpStatus: number | null;
        error: string | null;
        candidates: Record<string, unknown[]>;
      }>;
    }>;
  };
  const exa = JSON.parse(
    readFileSync(join(exaRoot, 'result.json'), 'utf8'),
  ) as {
    companies: Array<{
      domain: string;
      query: string;
      search: {
        results: Array<{ url: string; title: string; snippet: string }>;
        error: string | null;
      };
      fetchedPages: Array<{
        url: string;
        httpStatus: number | null;
        error: string | null;
        acceptedCandidates: Record<string, unknown[]>;
      }>;
    }>;
  };
  const exaByDomain = new Map(exa.companies.map((item) => [item.domain, item]));

  return previous.companies.map((company) => {
    const originCandidates = (
      origin: 'homepage' | 'contact_page' | 'exa',
      groups: Record<string, unknown[]>,
    ) => [
      ...(groups.emails ?? []).map((candidate) => ({ origin, candidate })),
      ...(groups.phones ?? []).map((candidate) => ({ origin, candidate })),
      ...(groups.postal_addresses ?? []).map((candidate) => ({
        origin,
        candidate,
      })),
      ...(groups.registration_identifiers ?? []).map((candidate) => ({
        origin,
        candidate,
      })),
    ];
    const historical = exaByDomain.get(company.domain);
    return {
      original: company.homepage.original,
      homepage: {
        url: company.homepage.fetchedUrl,
        status: company.homepage.httpStatus,
        error: company.homepage.fetchError,
        candidates: originCandidates('homepage', company.homepage.candidates),
      },
      contactPages: company.contactPages.map((contactPage) => ({
        url: contactPage.url,
        status: contactPage.httpStatus,
        error: contactPage.error,
        candidates: originCandidates('contact_page', contactPage.candidates),
      })),
      exa:
        historical === undefined
          ? null
          : {
              query: historical.query,
              results: historical.search.results,
              error: historical.search.error,
              pages: historical.fetchedPages.map((fetched) => ({
                url: fetched.url,
                status: fetched.httpStatus,
                error: fetched.error,
                candidates: originCandidates(
                  'exa',
                  fetched.acceptedCandidates,
                ),
              })),
            },
    } as CompanyContactEvidence;
  });
}

function referenceCompany(
  domain: string,
  name: string | null,
  evidence: CompanyContactEvidence,
): SourceCompany {
  return {
    sourceIndex: 0,
    key: domain,
    domain,
    registrableDomain: domain,
    name,
    legalName: null,
    code: null,
    vat: null,
    address: evidence.original.address,
    city: evidence.original.city,
    country: evidence.original.country,
    emails: [],
    phones: [],
    sources: [],
    offers: [],
    profileHash: domain,
  };
}

describe('Stage 05 contact discovery integration', () => {
  (hasReference ? it : it.skip)(
    'reproduces the accepted ownership-filter reference from saved evidence',
    async () => {
      const companies = JSON.parse(
        readFileSync(join(contactRoot as string, 'result.json'), 'utf8'),
      ) as {
        companies: Array<{ domain: string; companyName: string | null }>;
      };
      const evidence = evidenceFromReference();
      const results = companies.companies.map((company, index) =>
        consolidateContactEvidence(
          referenceCompany(company.domain, company.companyName, evidence[index]),
          evidence[index],
          'Lithuania',
          'LT',
        ),
      );
      const retained = results.filter((result) => result.retained);
      const excluded = results.filter((result) => !result.retained);
      const communicationReady = retained.reduce(
        (sum, result) => sum + result.usableEmails.length,
        0,
      );

      expect(retained).toHaveLength(64);
      expect(communicationReady).toBe(128);
      expect(
        results.reduce((sum, result) => sum + result.partnerEmails.length, 0),
      ).toBe(65);
      expect(
        excluded.filter(
          (result) => result.exclusionReason === 'MISSING_USABLE_COMPANY_EMAIL',
        ),
      ).toHaveLength(11);
      expect(
        excluded.filter(
          (result) =>
            result.exclusionReason ===
            'FOREIGN_TELEPHONE_NO_TARGET_ESTABLISHMENT',
        ),
      ).toHaveLength(2);
      expect(
        results.reduce((sum, result) => sum + result.uncertainEmails.length, 0),
      ).toBe(0);
    },
  );

  it('uses Exa only when homepage/contact discovery has no usable email', async () => {
    const company = sourceCompany({
      domain: 'acme.co',
      name: 'Acme Contact',
      emails: [],
      phones: [],
      address: null,
      city: null,
      country: null,
    });
    let searches = 0;
    const ports: ContactDiscoveryPorts = {
      homepage: {
        fetch: async () => page('<p>Acme Contact</p>', 'https://acme.co/'),
      },
      page: {
        fetch: async (url) =>
          url.includes('/contact')
            ? page('<p>Contact email info@other.co</p>', url)
            : page('<p>Contact email sales@acme.co</p>', url),
      },
      exa: {
        search: async (_query, _results, country) => {
          searches += 1;
          expect(country).toBe('Lithuania');
          return {
            query: 'Acme Contact contact email',
            results: [
              {
                url: 'https://acme.co/team',
                title: 'Acme Contact team',
                snippet: 'Contact sales',
              },
            ],
          };
        },
      },
    };
    const pipeline = new ContactDiscoveryPipeline(ports, extractContactCandidates);
    const withoutContact = await pipeline.collect(
      { ...company, name: 'Acme Contact' },
      'Lithuania',
      'LT',
    );
    expect(searches).toBe(1);
    expect(withoutContact.usableEmails.map((email) => email.value)).toContain(
      'sales@acme.co',
    );

    searches = 0;
    const withUsable: ContactDiscoveryPorts = {
      ...ports,
      page: {
        fetch: async (url) =>
          page('<p>Contact email info@acme.co</p>', url),
      },
      homepage: {
        fetch: async () =>
          page(
            '<a href="/contact">Contact</a><p>Acme Contact</p>',
            'https://acme.co/',
          ),
      },
    };
    const pipelineWithEmail = new ContactDiscoveryPipeline(
      withUsable,
      extractContactCandidates,
    );
    const withContact = await pipelineWithEmail.collect(
      { ...company, name: 'Acme Contact' },
      'Lithuania',
      'LT',
    );
    expect(withContact.usableEmails.map((email) => email.value)).toContain(
      'info@acme.co',
    );
    expect(searches).toBe(0);
  });

  it('retries one timed-out contact page, then stops retrying', async () => {
    const company = sourceCompany({
      domain: 'retry.co',
      name: 'Retry Contact',
      emails: [],
      phones: [],
      address: null,
      city: null,
      country: null,
    });
    let pageCalls = 0;
    let searches = 0;
    const ports: ContactDiscoveryPorts = {
      homepage: {
        fetch: async () =>
          page(
            '<a href="/contact">Contact</a><p>Retry Contact</p>',
            'https://retry.co/',
          ),
      },
      page: {
        fetch: async (url) => {
          pageCalls += 1;
          return page('', url, {
            status: null,
            error: 'The destination timed out.',
            failureKind: 'timeout',
          });
        },
      },
      exa: {
        search: async () => {
          searches += 1;
          return { query: 'unused', results: [] };
        },
      },
    };
    const pipeline = new ContactDiscoveryPipeline(ports, extractContactCandidates);
    const result = await pipeline.collect(company, 'Lithuania', 'LT');

    expect(pageCalls).toBe(2);
    expect(result.diagnostics.contactPages).toHaveLength(1);
    expect(result.diagnostics.contactPages[0]).toMatchObject({
      status: null,
      failureKind: 'timeout',
      attempts: 2,
      retried: true,
    });
    expect(result.diagnostics.fetches).toBe(3);
    expect(searches).toBe(2);
  });

  it('does not retry a successfully inspected contact page with no email', async () => {
    const company = sourceCompany({
      domain: 'inspected.co',
      name: 'Inspected Contact',
      emails: [],
      phones: [],
      address: null,
      city: null,
      country: null,
    });
    let pageCalls = 0;
    const ports: ContactDiscoveryPorts = {
      homepage: {
        fetch: async () =>
          page(
            '<a href="/contact">Contact</a><p>Inspected Contact</p>',
            'https://inspected.co/',
          ),
      },
      page: {
        fetch: async (url) => {
          pageCalls += 1;
          return page('<p>No contacts published here.</p>', url);
        },
      },
      exa: {
        search: async () => ({ query: 'unused', results: [] }),
      },
    };
    const pipeline = new ContactDiscoveryPipeline(ports, extractContactCandidates);
    const result = await pipeline.collect(company, 'Lithuania', 'LT');

    expect(pageCalls).toBe(1);
    expect(result.diagnostics.contactPages[0]).toMatchObject({
      status: 200,
      failureKind: null,
      attempts: 1,
      retried: false,
    });
  });

  it('runs a second legal-name Exa query only after the domain query fails', async () => {
    const company = sourceCompany({
      domain: 'acme.co',
      name: 'Acme Contact',
      legalName: 'Acme Legal Name',
      emails: [],
      phones: [],
      address: null,
      city: null,
      country: null,
    });
    const queries: string[] = [];
    const ports: ContactDiscoveryPorts = {
      homepage: {
        fetch: async () => page('<p>Acme Contact</p>', 'https://acme.co/'),
      },
      page: {
        fetch: async (url) =>
          url.includes('directory')
            ? page('<p>Contact email info@other.co</p>', url)
            : page(
                '<h1>Acme Legal Name</h1><p>Contact email sales@acme.co</p>',
                url,
              ),
      },
      exa: {
        search: async (query) => {
          queries.push(query);
          return queries.length === 1
            ? {
                query,
                results: [
                  {
                    url: 'https://directory.test/acme',
                    title: 'Acme Contact directory',
                    snippet: 'Contact details',
                  },
                ],
              }
            : {
                query,
                results: [
                  {
                    url: 'https://registry.test/acme-legal',
                    title: 'Acme Legal Name',
                    snippet: 'Registry record',
                  },
                ],
              };
        },
      },
    };
    const pipeline = new ContactDiscoveryPipeline(ports, extractContactCandidates);
    const result = await pipeline.collect(company, 'Lithuania', 'LT');

    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('acme.co');
    expect(queries[0]).toContain('kontaktai');
    expect(queries[0]).not.toContain('Acme Legal Name');
    expect(queries[1]).toContain('Acme Legal Name');
    expect(queries[1]).toContain('kontaktai');
    expect(result.usableEmails.map((email) => email.value)).toEqual([
      'sales@acme.co',
    ]);
    expect(result.uncertainEmails.map((email) => email.value)).toContain(
      'info@other.co',
    );
    expect(result.diagnostics.exa?.queries).toHaveLength(2);
  });
  it('rejects a directory operator mailbox even when the page verifies company identity', async () => {
    const company = sourceCompany({
      domain: 'acme.co',
      name: 'Acme Contact',
      emails: [],
      phones: [],
      address: null,
      city: null,
      country: null,
    });
    const ports: ContactDiscoveryPorts = {
      homepage: {
        fetch: async () => page('<p>Acme Contact</p>', 'https://acme.co/'),
      },
      page: {
        fetch: async (url) =>
          page(
            '<h1>Acme Contact</h1><p>Contact email info@directory.co</p><p>Contact email sales@acme.co</p>',
            url,
          ),
      },
      exa: {
        search: async (query) => ({
          query,
          results: [
            {
              url: 'https://directory.test/acme',
              title: 'Acme Contact directory',
              snippet: 'Company listing',
            },
          ],
        }),
      },
    };
    const pipeline = new ContactDiscoveryPipeline(ports, extractContactCandidates);
    const result = await pipeline.collect(company, 'Lithuania', 'LT');

    expect(result.usableEmails.map((email) => email.value)).toEqual([
      'sales@acme.co',
    ]);
    expect(result.uncertainEmails.map((email) => email.value)).toEqual([
      'info@directory.co',
    ]);
  });
  it('persists contact-discovery results through the existing run service', async () => {
    const company = sourceCompany({
      domain: 'alpha.co',
      name: 'Alpha Test',
      emails: [],
      phones: [],
      address: null,
      city: null,
      country: null,
    });
    const store = new FakeStore(researchRecord([company]));
    const ports: ContactDiscoveryPorts = {
      homepage: {
        fetch: async () =>
          page('<p>Contact email info@alpha.co</p>', 'https://alpha.co/'),
      },
      page: {
        fetch: async (url) => page('<p>No contact</p>', url),
      },
      exa: {
        search: async () => ({ query: 'unused', results: [] }),
      },
    };
    const pipeline = new ContactDiscoveryPipeline(ports, extractContactCandidates);
    const runtime = new ContactDiscoveryRuntime(store, pipeline);
    const run = await runtime.start('research-1', { autoStart: false });
    const completed = await runtime.execute(run.id);
    const result = store.results.get(run.id)?.get(0);
    expect(completed.status).toBe('COMPLETED');
    expect(result?.contacts.emails.map((email) => email.value)).toContain(
      'info@alpha.co',
    );
    expect(result?.metadata.contactDiscovery).toBeTruthy();
  });
});
