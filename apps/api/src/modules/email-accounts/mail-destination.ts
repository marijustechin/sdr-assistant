import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

import { Injectable } from '@nestjs/common';

/**
 * Destination guard for mail verification.
 *
 * A configured mail host is untrusted input. It is normalised, resolved once,
 * and every resolved address must be a public unicast address. The resolver
 * returns the address the caller must connect to, so the client never performs
 * a second, unchecked DNS lookup; the configured hostname is kept separately for
 * TLS server-name and certificate validation.
 *
 * IPv4 private, loopback, link-local, CGNAT, documentation, benchmarking,
 * multicast and reserved ranges and their IPv6 equivalents are rejected. An IPv6
 * destination must additionally be global unicast (2000::/3).
 */

export type ResolvedMailDestination = {
  readonly host: string;
  readonly address: string;
  readonly family: 4 | 6;
};

export type MailDestinationFailureCode =
  | 'INVALID_CONFIGURATION'
  | 'UNSAFE_DESTINATION'
  | 'DNS_FAILURE'
  | 'CONNECTION_TIMEOUT';

export class MailDestinationError extends Error {
  constructor(
    readonly failureCode: MailDestinationFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'MailDestinationError';
  }
}

export interface MailDestinationResolver {
  resolve(host: string, timeoutMs: number): Promise<ResolvedMailDestination>;
}

export type HostLookupAddress = {
  readonly address: string;
  readonly family: number;
};

export type HostLookup = (
  host: string,
) => Promise<readonly HostLookupAddress[]>;

const defaultHostLookup: HostLookup = (host) =>
  lookup(host, { all: true, verbatim: true });

const HOSTNAME_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOSTNAME_PATTERN = new RegExp(`^(?:${HOSTNAME_LABEL})(?:\\.${HOSTNAME_LABEL})*$`);
const MAX_HOSTNAME_LENGTH = 253;

const BLOCKED_ADDRESSES = new BlockList();

const BLOCKED_IPV4_RANGES: readonly (readonly [string, number])[] = [
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
];

// `::ffff:0:0/96` is deliberately absent: Node's BlockList also checks an IPv4
// address in its IPv4-mapped form, so that subnet would classify every IPv4
// address as blocked. IPv4-mapped IPv6 literals are rejected by the global
// unicast requirement below instead.
const BLOCKED_IPV6_RANGES: readonly (readonly [string, number])[] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

for (const [subnet, prefix] of BLOCKED_IPV4_RANGES) {
  BLOCKED_ADDRESSES.addSubnet(subnet, prefix, 'ipv4');
}

for (const [subnet, prefix] of BLOCKED_IPV6_RANGES) {
  BLOCKED_ADDRESSES.addSubnet(subnet, prefix, 'ipv6');
}

/**
 * Lower-cases and validates a configured host. IP literals are accepted as
 * given (bracketed forms are not, because the configured host is also used as
 * the TLS server name). Returns `null` for anything that is not a plain
 * hostname or IP literal.
 */
export function normalizeMailHostname(raw: string): string | null {
  const host = raw.trim().toLowerCase();

  if (host.length === 0 || host.length > MAX_HOSTNAME_LENGTH) {
    return null;
  }

  if (isIP(host) !== 0) {
    return host;
  }

  return HOSTNAME_PATTERN.test(host) ? host : null;
}

function isGlobalUnicastIpv6(address: string): boolean {
  const [firstSegment = ''] = address.split(':');

  if (firstSegment === '') {
    return false;
  }

  const value = Number.parseInt(firstSegment, 16);

  return Number.isInteger(value) && value >= 0x2000 && value <= 0x3fff;
}

function assertPublicAddress(address: string): void {
  const family = isIP(address);

  if (family === 4) {
    if (BLOCKED_ADDRESSES.check(address, 'ipv4')) {
      throw new MailDestinationError(
        'UNSAFE_DESTINATION',
        'The configured host resolves to a non-public address.',
      );
    }

    return;
  }

  if (family === 6) {
    if (
      !isGlobalUnicastIpv6(address) ||
      BLOCKED_ADDRESSES.check(address, 'ipv6')
    ) {
      throw new MailDestinationError(
        'UNSAFE_DESTINATION',
        'The configured host resolves to a non-public address.',
      );
    }

    return;
  }

  throw new MailDestinationError(
    'DNS_FAILURE',
    'The configured host resolved to an invalid address.',
  );
}

async function withLookupTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new MailDestinationError(
          'CONNECTION_TIMEOUT',
          'The host name lookup timed out.',
        ),
      );
    }, timeoutMs);

    timer.unref();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function resolveMailDestination(
  host: string,
  timeoutMs: number,
  hostLookup: HostLookup,
): Promise<ResolvedMailDestination> {
  const hostname = normalizeMailHostname(host);

  if (hostname === null) {
    throw new MailDestinationError(
      'INVALID_CONFIGURATION',
      'The configured host is not a valid host name.',
    );
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new MailDestinationError(
      'UNSAFE_DESTINATION',
      'The configured host is not a public destination.',
    );
  }

  const literalFamily = isIP(hostname);

  if (literalFamily !== 0) {
    assertPublicAddress(hostname);

    return {
      host: hostname,
      address: hostname,
      family: literalFamily === 4 ? 4 : 6,
    };
  }

  let addresses: readonly HostLookupAddress[];

  try {
    addresses = await withLookupTimeout(hostLookup(hostname), timeoutMs);
  } catch (error) {
    if (error instanceof MailDestinationError) {
      throw error;
    }

    throw new MailDestinationError(
      'DNS_FAILURE',
      'The configured host could not be resolved.',
    );
  }

  if (addresses.length === 0) {
    throw new MailDestinationError(
      'DNS_FAILURE',
      'The configured host could not be resolved.',
    );
  }

  for (const entry of addresses) {
    assertPublicAddress(entry.address);
  }

  const preferred =
    addresses.find((entry) => isIP(entry.address) === 4) ?? addresses[0];
  const family = isIP(preferred.address);

  if (family !== 4 && family !== 6) {
    throw new MailDestinationError(
      'DNS_FAILURE',
      'The configured host resolved to an invalid address.',
    );
  }

  return { host: hostname, address: preferred.address, family };
}

@Injectable()
export class SystemMailDestinationResolver implements MailDestinationResolver {
  constructor(private readonly hostLookup: HostLookup = defaultHostLookup) {}

  resolve(host: string, timeoutMs: number): Promise<ResolvedMailDestination> {
    return resolveMailDestination(host, timeoutMs, this.hostLookup);
  }
}
