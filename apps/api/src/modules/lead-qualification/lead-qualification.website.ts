import {
  DEFAULT_LEAD_QUALIFICATION_LIMITS,
  LEAD_QUALIFICATION_VERSION,
} from './lead-qualification.constants.js';
import { isInactivePage } from './lead-qualification.decision.js';
import {
  SafeHttpError,
  type SafeHttpResponse,
} from './lead-qualification.http.js';
import type {
  LeadQualificationLimits,
  WebsiteCheck,
} from './lead-qualification.types.js';

export interface WebsiteHttpClient {
  request(url: string): Promise<SafeHttpResponse>;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseCheck(): WebsiteCheck {
  return {
    status: 'UNKNOWN',
    reason: null,
    evidence: [],
    detail: null,
    technicalFailure: false,
    finalUrl: null,
    https: false,
    certificateValid: false,
    httpStatus: null,
    redirects: 0,
    temporary: false,
    failureKind: null,
    bodyText: '',
  };
}

function websiteEvidence(url: string | null): WebsiteCheck['evidence'] {
  if (url === null) return [];
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

export class WebsiteValidator {
  constructor(
    private readonly client: WebsiteHttpClient,
    private readonly limits: LeadQualificationLimits = DEFAULT_LEAD_QUALIFICATION_LIMITS,
    private readonly retryDelayMs = 0,
  ) {}

  async validate(domain: string): Promise<WebsiteCheck> {
    const url = this.httpsUrl(domain);

    if (url === null) {
      return {
        ...baseCheck(),
        status: 'FAIL',
        reason: 'WEBSITE_UNAVAILABLE',
        detail: 'The company domain is not a valid public hostname.',
        failureKind: 'unreachable',
      };
    }

    let httpsResponse: SafeHttpResponse | null = null;
    let httpsError: SafeHttpError | null = null;

    try {
      httpsResponse = await this.attempt(url);
    } catch (error) {
      httpsError =
        error instanceof SafeHttpError
          ? error
          : new SafeHttpError('NETWORK', 'Website request failed.');
    }

    if (httpsResponse !== null) {
      if (!this.sameCompanySite(domain, httpsResponse.url)) {
        return this.unrelatedRedirect(httpsResponse);
      }
      return this.classify(httpsResponse);
    }

    // A failed HTTPS endpoint may still expose an HTTP-only site, or an HTTP
    // redirect that discovers a working HTTPS endpoint. Never accept a final
    // HTTP page as satisfying the HTTPS gate.
    const httpUrl = this.httpUrl(domain);
    let httpResponse: SafeHttpResponse | null = null;
    let httpError: SafeHttpError | null = null;

    if (httpUrl !== null) {
      try {
        httpResponse = await this.attempt(httpUrl);
      } catch (error) {
        httpError =
          error instanceof SafeHttpError
            ? error
            : new SafeHttpError('NETWORK', 'Website request failed.');
      }
    }

    if (httpResponse !== null) {
      if (!this.sameCompanySite(domain, httpResponse.url)) {
        return this.unrelatedRedirect(httpResponse);
      }
      if (httpResponse.https) return this.classify(httpResponse);
      if (httpResponse.status === 404 || httpResponse.status === 410) {
        return {
          ...baseCheck(),
          status: 'FAIL',
          reason: 'WEBSITE_UNAVAILABLE',
          detail: 'The company website returned a permanent not-found status.',
          finalUrl: httpResponse.url,
          httpStatus: httpResponse.status,
          redirects: httpResponse.redirects,
          failureKind: 'unreachable',
          evidence: websiteEvidence(httpResponse.url),
        };
      }
      if (httpResponse.status >= 200 && httpResponse.status < 300) {
        return {
          ...baseCheck(),
          status: 'FAIL',
          reason: 'NO_VALID_HTTPS',
          detail: 'The company website is reachable only over HTTP.',
          finalUrl: httpResponse.url,
          httpStatus: httpResponse.status,
          redirects: httpResponse.redirects,
          bodyText: httpResponse.body,
          failureKind: 'http_only',
          evidence: websiteEvidence(httpResponse.url),
        };
      }
      return this.transientFailure(httpResponse);
    }

    const effective = httpsError ?? httpError;

    if (httpsError?.kind === 'TLS' || httpError?.kind === 'TLS') {
      return {
        ...baseCheck(),
        status: 'FAIL',
        reason: 'NO_VALID_HTTPS',
        detail: 'A valid HTTPS certificate could not be established.',
        failureKind: 'tls',
        evidence: websiteEvidence(url),
      };
    }

    if (effective?.kind === 'DNS') {
      return {
        ...baseCheck(),
        status: 'FAIL',
        reason: 'WEBSITE_UNAVAILABLE',
        detail: 'The company website hostname does not resolve.',
        failureKind: 'unreachable',
        evidence: websiteEvidence(url),
      };
    }

    return {
      ...baseCheck(),
      status: 'UNKNOWN',
      reason: 'PROCESSING_FAILED',
      detail: 'The website check failed transiently or was unsafe.',
      technicalFailure: true,
      temporary: true,
      failureKind: effective?.kind === 'UNSAFE_URL' ? 'unsafe' : 'transient',
      evidence: websiteEvidence(url),
    };
  }

  private sameCompanySite(domain: string, finalUrl: string): boolean {
    try {
      const base = new URL(
        domain.includes('://') ? domain : `https://${domain}`,
      ).hostname.toLowerCase().replace(/^www\./, '');
      const finalHost = new URL(finalUrl).hostname
        .toLowerCase()
        .replace(/^www\./, '');
      return finalHost === base || finalHost.endsWith(`.${base}`);
    } catch {
      return false;
    }
  }

  private unrelatedRedirect(response: SafeHttpResponse): WebsiteCheck {
    return {
      ...baseCheck(),
      status: 'FAIL',
      reason: 'WEBSITE_UNAVAILABLE',
      detail: 'The company website redirected to an unrelated domain.',
      finalUrl: response.url,
      httpStatus: response.status,
      redirects: response.redirects,
      failureKind: 'redirect_domain',
      evidence: websiteEvidence(response.url),
    };
  }

  private classify(response: SafeHttpResponse): WebsiteCheck {
    if (!response.https) {
      return {
        ...baseCheck(),
        status: 'FAIL',
        reason: 'NO_VALID_HTTPS',
        detail: 'The final website destination is not HTTPS.',
        finalUrl: response.url,
        httpStatus: response.status,
        redirects: response.redirects,
        bodyText: response.body,
        failureKind: 'http_only',
        evidence: websiteEvidence(response.url),
      };
    }

    if (response.status === 404 || response.status === 410) {
      return {
        ...baseCheck(),
        status: 'FAIL',
        reason: 'WEBSITE_UNAVAILABLE',
        detail: 'The company website returned a permanent not-found status.',
        finalUrl: response.url,
        https: true,
        certificateValid: true,
        httpStatus: response.status,
        redirects: response.redirects,
        bodyText: response.body,
        failureKind: 'unreachable',
        evidence: websiteEvidence(response.url),
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ...baseCheck(),
        status: 'UNKNOWN',
        reason: 'PROCESSING_FAILED',
        detail: 'The website blocked access; this is not a confirmed inactive site.',
        finalUrl: response.url,
        https: true,
        certificateValid: true,
        httpStatus: response.status,
        redirects: response.redirects,
        bodyText: response.body,
        temporary: true,
        technicalFailure: true,
        failureKind: 'access_restricted',
        evidence: websiteEvidence(response.url),
      };
    }

    if (response.status < 200 || response.status >= 300) {
      return {
        ...this.transientFailure(response),
        finalUrl: response.url,
        https: true,
        certificateValid: true,
        bodyText: response.body,
      };
    }

    if (isInactivePage(response.body)) {
      return {
        ...baseCheck(),
        status: 'FAIL',
        reason: 'INACTIVE_BUSINESS',
        detail: 'The website contains parked, expired or abandoned markers.',
        finalUrl: response.url,
        https: true,
        certificateValid: true,
        httpStatus: response.status,
        redirects: response.redirects,
        bodyText: response.body,
        failureKind: 'parked',
        evidence: websiteEvidence(response.url),
      };
    }

    return {
      ...baseCheck(),
      status: 'PASS',
      reason: null,
      detail: 'Operational HTTPS website.',
      finalUrl: response.url,
      https: true,
      certificateValid: true,
      httpStatus: response.status,
      redirects: response.redirects,
      bodyText: response.body,
      failureKind: null,
      evidence: websiteEvidence(response.url),
    };
  }

  private transientFailure(response: SafeHttpResponse): WebsiteCheck {
    return {
      ...baseCheck(),
      status: 'UNKNOWN',
      reason: 'PROCESSING_FAILED',
      detail: 'The website returned a transient or access error.',
      finalUrl: response.url,
      https: response.https,
      certificateValid: response.https,
      httpStatus: response.status,
      redirects: response.redirects,
      temporary: true,
      technicalFailure: true,
      failureKind: 'transient',
      evidence: websiteEvidence(response.url),
    };
  }

  private async attempt(url: string): Promise<SafeHttpResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < Math.max(1, this.limits.websiteAttempts); attempt += 1) {
      try {
        const response = await this.client.request(url);
        if (
          RETRYABLE_STATUS.has(response.status) &&
          attempt + 1 < this.limits.websiteAttempts
        ) {
          await sleep(this.retryDelayMs);
          continue;
        }
        return response;
      } catch (error) {
        const safe =
          error instanceof SafeHttpError
            ? error
            : new SafeHttpError('NETWORK', 'Website request failed.');
        lastError = safe;
        if (safe.transient && attempt + 1 < this.limits.websiteAttempts) {
          await sleep(this.retryDelayMs);
          continue;
        }
        throw safe;
      }
    }

    throw lastError ?? new SafeHttpError('NETWORK', 'Website request failed.');
  }

  private httpsUrl(domain: string): string | null {
    return this.urlFor(domain, 'https');
  }

  private httpUrl(domain: string): string | null {
    return this.urlFor(domain, 'http');
  }

  private urlFor(domain: string, scheme: 'http' | 'https'): string | null {
    try {
      const cleaned = domain.trim();
      const parsed = new URL(
        cleaned.includes('://') ? cleaned : `${scheme}://${cleaned}`,
      );
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      parsed.protocol = `${scheme}:`;
      parsed.hash = '';
      parsed.username = '';
      parsed.password = '';
      if (parsed.pathname === '') parsed.pathname = '/';
      return parsed.toString();
    } catch {
      return null;
    }
  }
}

export const WEBSITE_VALIDATION_VERSION = LEAD_QUALIFICATION_VERSION;
