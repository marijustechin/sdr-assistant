import { extractContactCandidates } from '../contact-discovery/contact-discovery.extractor.js';
import {
  SafeHttpClient,
  SafeHttpError,
} from '../lead-qualification/lead-qualification.http.js';
import { DEFAULT_LEAD_QUALIFICATION_LIMITS } from '../lead-qualification/lead-qualification.constants.js';
import { searchExa } from '../research/lib/exa-search.js';
import {
  ContactDiscoveryPipeline,
} from './contact-discovery-pipeline.js';
import type {
  ContactDiscoveryLimits,
  ContactDiscoveryPorts,
  ContactPageFailureKind,
} from './contact-discovery-pipeline.types.js';
import { DEFAULT_CONTACT_DISCOVERY_LIMITS } from './contact-discovery-pipeline.types.js';

function pageFailureKind(error: unknown): ContactPageFailureKind {
  if (!(error instanceof SafeHttpError)) return 'retrieval';
  switch (error.kind) {
    case 'TIMEOUT':
      return 'timeout';
    case 'TLS':
      return 'tls';
    case 'DNS':
      return 'dns';
    case 'UNSAFE_URL':
      return 'unsafe';
    case 'TOO_MANY_REDIRECTS':
      return 'redirects';
    case 'NETWORK':
      return 'network';
    default:
      return 'retrieval';
  }
}
export type LiveContactDiscoveryOptions = {
  limits?: Partial<ContactDiscoveryLimits>;
  http?: {
    timeoutMs?: number;
    pageTimeoutMs?: number;
    maxRedirects?: number;
    maxBodyBytes?: number;
  };
};

/**
 * Builds the live port set without performing any request. The caller decides
 * when to execute the pipeline.
 */
export function createLiveContactDiscoveryPipeline(
  options: LiveContactDiscoveryOptions = {},
): ContactDiscoveryPipeline {
  const limits: ContactDiscoveryLimits = {
    ...DEFAULT_CONTACT_DISCOVERY_LIMITS,
    ...options.limits,
  };
  const httpLimits = {
    timeoutMs:
      options.http?.timeoutMs ??
      DEFAULT_LEAD_QUALIFICATION_LIMITS.websiteTimeoutMs,
    maxRedirects:
      options.http?.maxRedirects ??
      DEFAULT_LEAD_QUALIFICATION_LIMITS.websiteMaxRedirects,
    maxBodyBytes:
      options.http?.maxBodyBytes ??
      DEFAULT_LEAD_QUALIFICATION_LIMITS.websiteMaxBodyBytes,
  };
  const client = new SafeHttpClient(httpLimits);
  const pageClient = new SafeHttpClient({
    ...httpLimits,
    timeoutMs: options.http?.pageTimeoutMs ?? 15_000,
  });

  const ports: ContactDiscoveryPorts = {
    homepage: {
      async fetch(domain) {
        const attempts: string[] = [];
        try {
          const response = await client.request(`https://${domain}/`);
          return {
            url: response.url,
            status: response.status,
            body: response.body,
            redirects: response.redirects,
            error: null,
          };
        } catch (error) {
          attempts.push(error instanceof Error ? error.message : String(error));
        }
        try {
          const response = await client.request(`http://${domain}/`);
          return {
            url: response.url,
            status: response.status,
            body: response.body,
            redirects: response.redirects,
            error: null,
          };
        } catch (error) {
          attempts.push(error instanceof Error ? error.message : String(error));
          return {
            url: `https://${domain}/`,
            status: null,
            body: '',
            redirects: 0,
            error: attempts.join(' | '),
          };
        }
      },
    },
    page: {
      async fetch(url) {
        try {
          const response = await client.request(url);
          return {
            url: response.url,
            status: response.status,
            body: response.body,
            redirects: response.redirects,
            error: null,
          };
        } catch (error) {
          return {
            url,
            status: null,
            body: '',
            redirects: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
    exa: {
      async search(query, results, country) {
        const response = await searchExa(query, results, country);
        return {
          query: response.query,
          results: response.results.map((result) => ({
            url: result.url,
            title: result.title ?? '',
            snippet: (result.highlights ?? []).join(' '),
          })),
        };
      },
    },
  };

  return new ContactDiscoveryPipeline(
    ports,
    extractContactCandidates,
    limits,
  );
}
