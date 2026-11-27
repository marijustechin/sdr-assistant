import { describe, expect, it } from 'vitest';

import {
  STRICT_TLS_OPTIONS,
  SafeHttpError,
  assertSafePublicUrl,
  ipv4FromMappedIpv6,
  isPublicAddress,
  resolvePublicAddresses,
  resolveSafeRedirect,
  type SafeHttpResponse,
} from '../../src/modules/lead-qualification/lead-qualification.http.js';
import {
  WebsiteValidator,
  type WebsiteHttpClient,
} from '../../src/modules/lead-qualification/lead-qualification.website.js';
import { DEFAULT_LEAD_QUALIFICATION_LIMITS } from '../../src/modules/lead-qualification/lead-qualification.constants.js';

function response(overrides: Partial<SafeHttpResponse> = {}): SafeHttpResponse {
  return {
    url: 'https://alpha.test/',
    status: 200,
    headers: {},
    body: 'Alpha UAB product catalogue shop contact',
    truncated: false,
    redirects: 0,
    https: true,
    certificateValid: true,
    ...overrides,
  };
}

class FakeClient implements WebsiteHttpClient {
  constructor(
    private readonly https: SafeHttpResponse | Error,
    private readonly http: SafeHttpResponse | Error = new SafeHttpError('NETWORK', 'no http'),
  ) {}

  async request(url: string): Promise<SafeHttpResponse> {
    const value = url.startsWith('https:') ? this.https : this.http;
    if (value instanceof Error) throw value;
    return value;
  }
}

function validator(client: WebsiteHttpClient): WebsiteValidator {
  return new WebsiteValidator(
    client,
    DEFAULT_LEAD_QUALIFICATION_LIMITS,
    0,
  );
}

describe('SDR-007A safe destination and website validation', () => {
  it('validates a normal HTTPS operational website', async () => {
    const check = await validator(new FakeClient(response())).validate('alpha.test');
    expect(check.status).toBe('PASS');
    expect(check.https).toBe(true);
    expect(check.certificateValid).toBe(true);
  });

  it('rejects an HTTP-only website with NO_VALID_HTTPS', async () => {
    const check = await validator(
      new FakeClient(
        new SafeHttpError('NETWORK', 'no tls', false),
        response({ url: 'http://alpha.test/', https: false, certificateValid: false }),
      ),
    ).validate('alpha.test');
    expect(check.status).toBe('FAIL');
    expect(check.reason).toBe('NO_VALID_HTTPS');
    expect(check.failureKind).toBe('http_only');
  });

  it('accepts a successful HTTP-to-HTTPS redirect', async () => {
    const check = await validator(
      new FakeClient(
        new SafeHttpError('NETWORK', 'initial tls unavailable', false),
        response({ url: 'https://alpha.test/', https: true, redirects: 1 }),
      ),
    ).validate('alpha.test');
    expect(check.status).toBe('PASS');
    expect(check.https).toBe(true);
  });

  it('rejects a redirect to an unrelated company domain', async () => {
    const check = await validator(
      new FakeClient(
        response({
          url: 'https://unrelated.test/',
          https: true,
          redirects: 1,
        }),
      ),
    ).validate('alpha.test');
    expect(check.status).toBe('FAIL');
    expect(check.reason).toBe('WEBSITE_UNAVAILABLE');
    expect(check.failureKind).toBe('redirect_domain');
  });

  it('treats an invalid certificate as NO_VALID_HTTPS', async () => {
    const check = await validator(
      new FakeClient(
        new SafeHttpError('TLS', 'certificate invalid', false),
        new SafeHttpError('TLS', 'certificate invalid', false),
      ),
    ).validate('alpha.test');
    expect(check.reason).toBe('NO_VALID_HTTPS');
  });

  it('treats a non-resolving hostname as unavailable', async () => {
    const check = await validator(
      new FakeClient(
        new SafeHttpError('DNS', 'not found', false),
        new SafeHttpError('DNS', 'not found', false),
      ),
    ).validate('alpha.test');
    expect(check.reason).toBe('WEBSITE_UNAVAILABLE');
  });

  it('does not classify a transient timeout as a confirmed inactive business', async () => {
    const check = await validator(
      new FakeClient(
        new SafeHttpError('TIMEOUT', 'timeout', true),
        new SafeHttpError('TIMEOUT', 'timeout', true),
      ),
    ).validate('alpha.test');
    expect(check.status).toBe('UNKNOWN');
    expect(check.reason).toBe('PROCESSING_FAILED');
    expect(check.technicalFailure).toBe(true);
  });

  it('rejects parked content as INACTIVE_BUSINESS', async () => {
    const check = await validator(
      new FakeClient(response({ body: 'This domain is for sale. Buy this domain.' })),
    ).validate('alpha.test');
    expect(check.status).toBe('FAIL');
    expect(check.reason).toBe('INACTIVE_BUSINESS');
  });

  it('does not follow an unsafe URL supplied directly', async () => {
    expect(() => assertSafePublicUrl('http://127.0.0.1/')).toThrowError(SafeHttpError);
    expect(() => assertSafePublicUrl('http://10.0.0.5/')).toThrowError(SafeHttpError);
    expect(() => assertSafePublicUrl('http://[::1]/')).toThrowError(SafeHttpError);
    expect(() => assertSafePublicUrl('file:///etc/passwd')).toThrowError(SafeHttpError);
    expect(() => assertSafePublicUrl('https://user:pass@alpha.test/')).toThrowError(
      SafeHttpError,
    );
  });

  it('classifies public and reserved IPv4/IPv6 ranges', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('127.0.0.1')).toBe(false);
    expect(isPublicAddress('10.0.0.5')).toBe(false);
    expect(isPublicAddress('172.16.0.1')).toBe(false);
    expect(isPublicAddress('192.168.1.1')).toBe(false);
    expect(isPublicAddress('169.254.1.1')).toBe(false);
    expect(isPublicAddress('100.64.0.1')).toBe(false);
    expect(isPublicAddress('192.0.2.1')).toBe(false);
    expect(isPublicAddress('224.0.0.1')).toBe(false);
    expect(isPublicAddress('::1')).toBe(false);
    expect(isPublicAddress('fc00::1')).toBe(false);
    expect(isPublicAddress('fe80::1')).toBe(false);
    expect(isPublicAddress('2001:db8::1')).toBe(false);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('classifies IPv4-mapped IPv6 in dotted and hexadecimal forms', () => {
    expect(ipv4FromMappedIpv6('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(ipv4FromMappedIpv6('::ffff:7f00:1')).toBe('127.0.0.1');
    expect(ipv4FromMappedIpv6('0:0:0:0:0:ffff:7f00:1')).toBe('127.0.0.1');
    expect(ipv4FromMappedIpv6('::ffff:5db8:d822')).toBe('93.184.216.34');
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('0:0:0:0:0:ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('::ffff:a9fe:1')).toBe(false);
    expect(isPublicAddress('::ffff:c0a8:101')).toBe(false);
    expect(isPublicAddress('::ffff:6440:1')).toBe(false);
    expect(isPublicAddress('::ffff:93.184.216.34')).toBe(true);
    expect(isPublicAddress('::ffff:5db8:d822')).toBe(true);
    expect(isPublicAddress('::ffff:0:0')).toBe(false);
  });

  it('never disables certificate validation', () => {
    expect(STRICT_TLS_OPTIONS.rejectUnauthorized).toBe(true);
  });

  it('rejects a redirect location that resolves to a private destination', () => {
    const current = new URL('https://alpha.test/');
    expect(() => resolveSafeRedirect(current, 'http://127.0.0.1/')).toThrowError(
      SafeHttpError,
    );
    expect(() => resolveSafeRedirect(current, 'http://[::ffff:7f00:1]/')).toThrowError(
      SafeHttpError,
    );
    expect(resolveSafeRedirect(current, '/contact').toString()).toBe(
      'https://alpha.test/contact',
    );
  });

  it('rejects mixed public/private DNS answers before pinning', async () => {
    await expect(
      resolvePublicAddresses('alpha.test', async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.3', family: 4 },
      ]),
    ).rejects.toBeInstanceOf(SafeHttpError);
  });

  it('rejects DNS answers containing only private or mapped-private addresses', async () => {
    await expect(
      resolvePublicAddresses('alpha.test', async () => [
        { address: '192.168.1.10', family: 4 },
      ]),
    ).rejects.toBeInstanceOf(SafeHttpError);
    await expect(
      resolvePublicAddresses('alpha.test', async () => [
        { address: '::ffff:7f00:1', family: 6 },
      ]),
    ).rejects.toBeInstanceOf(SafeHttpError);
  });

  it('returns the validated public DNS answer for pinning', async () => {
    const answers = await resolvePublicAddresses('alpha.test', async () => [
      { address: '93.184.216.34', family: 4 },
    ]);
    expect(answers).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
});
