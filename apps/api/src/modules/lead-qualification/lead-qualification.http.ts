import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export type SafeHttpResponse = {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  redirects: number;
  https: boolean;
  certificateValid: boolean;
};

export type SafeHttpErrorKind =
  | 'UNSAFE_URL'
  | 'DNS'
  | 'TLS'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'TOO_MANY_REDIRECTS';

export class SafeHttpError extends Error {
  readonly kind: SafeHttpErrorKind;
  readonly transient: boolean;

  constructor(kind: SafeHttpErrorKind, message: string, transient = false) {
    super(message);
    this.name = 'SafeHttpError';
    this.kind = kind;
    this.transient = transient;
  }
}

export const STRICT_TLS_OPTIONS = { rejectUnauthorized: true } as const;

const BLOCKED_V4 = new net.BlockList();
const BLOCKED_V6 = new net.BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED_V4.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 3],
  ['4000::', 2],
  ['8000::', 2],
  ['c000::', 2],
  ['100::', 64],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED_V6.addSubnet(network, prefix, 'ipv6');
}

function expandIpv6(address: string): number[] | null {
  if (address.includes('.')) return null;
  const pieces = address.split('::');
  if (pieces.length > 2) return null;
  const left = pieces[0] ? pieces[0].split(':') : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => '0'),
    ...right,
  ].map((group) => (/^[0-9a-f]{1,4}$/i.test(group) ? parseInt(group, 16) : Number.NaN));
  return groups.length === 8 && groups.every((group) => !Number.isNaN(group))
    ? groups
    : null;
}

/** Converts only IPv4-mapped IPv6 forms, including hexadecimal shorthand. */
export function ipv4FromMappedIpv6(address: string): string | null {
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted?.[1]) return dotted[1];

  const groups = expandIpv6(address.toLowerCase());
  if (!groups) return null;
  if (groups.slice(0, 5).some((group) => group !== 0) || groups[5] !== 0xffff) {
    return null;
  }

  return [
    (groups[6] ?? 0) >> 8,
    (groups[6] ?? 0) & 0xff,
    (groups[7] ?? 0) >> 8,
    (groups[7] ?? 0) & 0xff,
  ].join('.');
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !BLOCKED_V4.check(address, 'ipv4');
  if (family === 6) {
    const mapped = ipv4FromMappedIpv6(address);
    if (mapped !== null) return isPublicAddress(mapped);
    return !BLOCKED_V6.check(address, 'ipv6');
  }
  return false;
}

function privateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan') ||
    lower.endsWith('.home')
  );
}

/** Rejects credential-bearing, non-HTTP(S), private-literal and local hosts. */
export function assertSafePublicUrl(input: string): URL {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new SafeHttpError('UNSAFE_URL', 'Malformed URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeHttpError('UNSAFE_URL', 'Only HTTP(S) destinations are allowed.');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new SafeHttpError('UNSAFE_URL', 'Credential-bearing URLs are not allowed.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname.length === 0 || privateHostname(hostname)) {
    throw new SafeHttpError('UNSAFE_URL', 'Local or empty destinations are not allowed.');
  }

  if (net.isIP(hostname) > 0 && !isPublicAddress(hostname)) {
    throw new SafeHttpError('UNSAFE_URL', 'Private IP destinations are not allowed.');
  }

  return url;
}

export function resolveSafeRedirect(current: URL, location: string): URL {
  return assertSafePublicUrl(new URL(location, current).toString());
}

export type ResolvedAddress = {
  address: string;
  family: number;
};

export type LookupAddresses = (
  hostname: string,
) => Promise<ResolvedAddress[]>;

async function defaultLookup(hostname: string): Promise<ResolvedAddress[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((result) => ({
    address: result.address,
    family: result.family,
  }));
}

async function withDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new SafeHttpError('TIMEOUT', 'The destination timed out.', true),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Resolves once, validates every answer, and returns the pinned public address. */
export async function resolvePublicAddresses(
  hostname: string,
  lookup: LookupAddresses = defaultLookup,
  timeoutMs = 10_000,
): Promise<ResolvedAddress[]> {
  const cleaned = hostname.replace(/^\[|\]$/g, '');
  const literalFamily = net.isIP(cleaned);

  if (literalFamily > 0) {
    if (!isPublicAddress(cleaned)) {
      throw new SafeHttpError('UNSAFE_URL', 'Private IP destinations are not allowed.');
    }
    return [{ address: cleaned, family: literalFamily }];
  }

  let results: ResolvedAddress[];

  try {
    results = await withDeadline(lookup(cleaned), timeoutMs);
  } catch (error) {
    if (error instanceof SafeHttpError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    throw new SafeHttpError(
      'DNS',
      'The destination hostname could not be resolved.',
      code === 'EAI_AGAIN' || code === 'ETIMEDOUT',
    );
  }

  if (results.length === 0) {
    throw new SafeHttpError('DNS', 'The destination hostname has no addresses.');
  }

  if (results.some((result) => !isPublicAddress(result.address))) {
    throw new SafeHttpError(
      'UNSAFE_URL',
      'The destination resolves to a private or reserved address.',
    );
  }

  return results;
}

type RawResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
};

function headerValue(
  headers: http.IncomingHttpHeaders,
  name: string,
): string | null {
  const value = headers[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return null;
}

export function readResponse(
  response: http.IncomingMessage,
  maxBodyBytes: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let truncated = false;
    let settled = false;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') headers[key.toLowerCase()] = value;
      else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(', ');
    }

    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve({
        status: response.statusCode ?? 0,
        headers,
        body: Buffer.concat(chunks).toString('utf8'),
        truncated,
      });
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      reject(new SafeHttpError('NETWORK', 'The destination response failed.'));
    };

    response.on('data', (chunk: string | Buffer) => {
      if (settled) return;
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      if (bytes >= maxBodyBytes) {
        truncated = true;
        response.destroy();
        finish();
        return;
      }
      const remaining = maxBodyBytes - bytes;
      if (buffer.length > remaining) {
        chunks.push(buffer.subarray(0, remaining));
        bytes = maxBodyBytes;
        truncated = true;
        response.destroy();
        finish();
        return;
      }
      chunks.push(buffer);
      bytes += buffer.length;
    });
    response.on('error', fail);
    response.on('aborted', finish);
    response.on('close', finish);
    response.on('end', finish);
  });
}

function isTlsError(error: NodeJS.ErrnoException): boolean {
  const code = error.code ?? '';
  return (
    code.includes('CERT') ||
    code.includes('TLS') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID'
  );
}

function mapRequestError(
  error: NodeJS.ErrnoException,
  timedOut: boolean,
): SafeHttpError {
  if (timedOut || error.code === 'ETIMEDOUT') {
    return new SafeHttpError('TIMEOUT', 'The destination timed out.', true);
  }
  if (isTlsError(error)) {
    return new SafeHttpError('TLS', 'The HTTPS certificate is not valid.');
  }
  if (error.code === 'ENOTFOUND') {
    return new SafeHttpError('DNS', 'The destination hostname does not exist.');
  }
  if (error.code === 'EAI_AGAIN') {
    return new SafeHttpError('DNS', 'Temporary DNS failure.', true);
  }
  if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
    return new SafeHttpError('NETWORK', 'The destination connection was reset.', true);
  }
  return new SafeHttpError('NETWORK', 'The destination could not be reached.');
}

export class SafeHttpClient {
  constructor(
    private readonly options: {
      timeoutMs: number;
      maxRedirects: number;
      maxBodyBytes: number;
      lookup?: LookupAddresses;
    },
  ) {}

  async request(input: string): Promise<SafeHttpResponse> {
    let current = assertSafePublicUrl(input);
    let redirects = 0;

    for (;;) {
      const resolved = await resolvePublicAddresses(
        current.hostname,
        this.options.lookup,
        this.options.timeoutMs,
      );
      const raw = await this.requestOnce(current, resolved[0]);

      if (
        [301, 302, 303, 307, 308].includes(raw.status) &&
        raw.headers.location
      ) {
        if (redirects >= this.options.maxRedirects) {
          throw new SafeHttpError(
            'TOO_MANY_REDIRECTS',
            'The destination redirected too many times.',
          );
        }
        current = resolveSafeRedirect(current, raw.headers.location);
        redirects += 1;
        continue;
      }

      return {
        url: current.toString(),
        status: raw.status,
        headers: raw.headers,
        body: raw.body,
        truncated: raw.truncated,
        redirects,
        https: current.protocol === 'https:',
        certificateValid: current.protocol === 'https:',
      };
    }
  }

  private async requestOnce(
    url: URL,
    resolved: ResolvedAddress,
  ): Promise<RawResponse> {
    const isHttps = url.protocol === 'https:';
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    let timedOut = false;

    return new Promise<RawResponse>((resolve, reject) => {
      const requestOptions: https.RequestOptions = {
        method: 'GET',
        hostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        headers: {
          'user-agent': 'SDR-Assistant-Stage05/1.0',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
          'accept-language': 'en,lt;q=0.8',
        },
        lookup: (_hostname, options, callback) => {
          if (typeof options === 'object' && options.all) {
            callback(null, [
              { address: resolved.address, family: resolved.family },
            ]);
          } else {
            callback(null, resolved.address, resolved.family);
          }
        },
        ...(isHttps
          ? {
              servername:
                net.isIP(hostname) === 0 ? hostname : undefined,
              ...STRICT_TLS_OPTIONS,
            }
          : {}),
      };

      let request: http.ClientRequest;
      let deadline: NodeJS.Timeout;
      const settle = (value: RawResponse): void => {
        clearTimeout(deadline);
        resolve(value);
      };
      const fail = (error: unknown): void => {
        clearTimeout(deadline);
        reject(error);
      };
      const onResponse = (response: http.IncomingMessage): void => {
        readResponse(response, this.options.maxBodyBytes).then(settle).catch(fail);
      };
      request = isHttps
        ? https.request(requestOptions, onResponse)
        : http.request(requestOptions, onResponse);
      deadline = setTimeout(() => {
        timedOut = true;
        fail(new SafeHttpError('TIMEOUT', 'The destination timed out.', true));
        request.destroy();
      }, this.options.timeoutMs);

      request.setTimeout(this.options.timeoutMs, () => {
        timedOut = true;
        request.destroy();
      });
      request.on('error', (error: Error) => {
        fail(mapRequestError(error as NodeJS.ErrnoException, timedOut));
      });
      request.end();
    });
  }
}
