/**
 * Shared vocabulary of the email-connection verification feature.
 *
 * The protocol ports are the only destinations a verification may connect to.
 * A saved configuration using any other port is reported as invalid instead of
 * being contacted.
 */

export const MAIL_PROTOCOLS = ['SMTP', 'IMAP'] as const;

export type MailProtocol = (typeof MAIL_PROTOCOLS)[number];

/** Standard mail ports only; verification never dials another port. */
export const MAIL_PROTOCOL_PORTS: Record<MailProtocol, readonly number[]> = {
  SMTP: [465, 587],
  IMAP: [993, 143],
};

export function isAllowedMailPort(protocol: MailProtocol, port: number): boolean {
  return MAIL_PROTOCOL_PORTS[protocol].includes(port);
}

/**
 * `NOT_TESTED` is also the state a configuration change restores: a historical
 * result describes the configuration that was tested, not the current one.
 */
export const EMAIL_VERIFICATION_STATUSES = [
  'NOT_TESTED',
  'VERIFIED',
  'FAILED',
] as const;

export type EmailVerificationStatus =
  (typeof EMAIL_VERIFICATION_STATUSES)[number];

/**
 * Safe, enumerable failure codes. They are the only failure detail the API and
 * the database ever store; raw library errors and provider responses are never
 * mapped into either.
 */
export const EMAIL_VERIFICATION_FAILURE_CODES = [
  'AUTHENTICATION_FAILED',
  'CONNECTION_TIMEOUT',
  'DNS_FAILURE',
  'CONNECTION_REFUSED',
  'TLS_FAILURE',
  'INVALID_CONFIGURATION',
  'UNSAFE_DESTINATION',
  'CREDENTIAL_UNAVAILABLE',
  'CONNECTION_FAILED',
] as const;

export type EmailVerificationFailureCode =
  (typeof EMAIL_VERIFICATION_FAILURE_CODES)[number];

/**
 * Bounded time budgets. Every phase has its own limit and the overall timeout
 * is the hard ceiling for the whole verification request.
 */
export const CONNECTION_VERIFICATION_TIMEOUTS = {
  dnsLookupMs: 5_000,
  connectionMs: 8_000,
  greetingMs: 8_000,
  socketMs: 10_000,
  overallMs: 20_000,
} as const;

export type ConnectionVerificationTimeouts = {
  readonly connectionMs: number;
  readonly greetingMs: number;
  readonly socketMs: number;
  readonly overallMs: number;
};

export const SMTP_VERIFICATION_TIMEOUTS: ConnectionVerificationTimeouts = {
  connectionMs: CONNECTION_VERIFICATION_TIMEOUTS.connectionMs,
  greetingMs: CONNECTION_VERIFICATION_TIMEOUTS.greetingMs,
  socketMs: CONNECTION_VERIFICATION_TIMEOUTS.socketMs,
  overallMs: CONNECTION_VERIFICATION_TIMEOUTS.overallMs,
};

export const IMAP_VERIFICATION_TIMEOUTS: ConnectionVerificationTimeouts = {
  connectionMs: CONNECTION_VERIFICATION_TIMEOUTS.connectionMs,
  greetingMs: CONNECTION_VERIFICATION_TIMEOUTS.greetingMs,
  socketMs: CONNECTION_VERIFICATION_TIMEOUTS.socketMs,
  overallMs: CONNECTION_VERIFICATION_TIMEOUTS.overallMs,
};

/**
 * One saved protocol configuration, already reduced to the destination and the
 * credential the requested protocol needs. The `host` is the configured
 * hostname used for TLS validation; `address` is the validated public IP the
 * client actually connects to.
 */
export type ConnectionVerificationTarget = {
  readonly protocol: MailProtocol;
  readonly host: string;
  readonly address: string;
  readonly port: number;
  readonly security: 'TLS' | 'STARTTLS';
  readonly username: string;
  readonly password: string;
};
