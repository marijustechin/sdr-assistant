import type { EmailVerificationFailureCode } from './email-connection.constants.js';
import { MailDestinationError } from './mail-destination.js';

/**
 * The overall verification timeout. It is separate from the library's own
 * connection, greeting and socket timeouts and is the hard ceiling of one
 * request.
 */
export class ConnectionTimeoutError extends Error {
  readonly code = 'VERIFICATION_TIMEOUT';

  constructor(message = 'The connection test timed out.') {
    super(message);
    this.name = 'ConnectionTimeoutError';
  }
}

/**
 * Settles with `promise` or rejects with `ConnectionTimeoutError` after
 * `timeoutMs`. The original promise always has handlers attached here, so a
 * late rejection after the timeout is never an unhandled rejection.
 */
export function withConnectionTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ConnectionTimeoutError());
    }, timeoutMs);

    timer.unref();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const AUTHENTICATION_ERROR_CODES = new Set([
  'EAUTH',
  'ENOAUTH',
  'AUTHENTICATIONFAILED',
  'AUTHORIZATIONFAILED',
  'LOGINDISABLED',
  'NOLOGIN',
  'NoSupportedAuthMechanisms',
  'NoSupportedAuthMechanism',
]);

const AUTHENTICATION_RESPONSE_CODES = new Set([454, 530, 534, 535, 538]);

const TIMEOUT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ETIMEOUT',
  'CONNECT_TIMEOUT',
  'GREETING_TIMEOUT',
  'UPGRADE_TIMEOUT',
  'SOCKET_TIMEOUT',
  'VERIFICATION_TIMEOUT',
]);

const DNS_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'EAI_FAIL',
  'EAI_NONAME',
  'EAI_NODATA',
  'ENODATA',
  'EDNS',
  'NOTFOUND',
  'SERVFAIL',
]);

// Node exposes an OpenSSL X509 verification failure as the error's `code`, using
// the OpenSSL reason name. These are the certificate and CRL verification
// reasons that can reach a client handshake; `CERT_*` codes are also matched by
// prefix below. Network, DNS and authentication codes deliberately stay out of
// this set.
const TLS_ERROR_CODES = new Set([
  'EPROTO',
  'ETLS',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_REVOKED',
  'CERT_UNTRUSTED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_TLS_CERT_ALTNAME_INVALID_IP',
  'ERR_TLS_HANDSHAKE_TIMEOUT',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA',
  // Remaining OpenSSL certificate / CRL verification reasons.
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_GET_CRL_ISSUER',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'CRL_SIGNATURE_FAILURE',
  'CRL_NOT_YET_VALID',
  'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD',
  'INVALID_CA',
  'PATH_LENGTH_EXCEEDED',
  'INVALID_PURPOSE',
  'HOSTNAME_MISMATCH',
  'SUBJECT_ISSUER_MISMATCH',
  'AKID_SKID_MISMATCH',
  'AKID_ISSUER_SERIAL_MISMATCH',
  'KEYUSAGE_NO_CERTSIGN',
  'UNHANDLED_CRITICAL_EXTENSION',
  'UNHANDLED_CRITICAL_CRL_EXTENSION',
  'INVALID_NON_CA',
  'PROXY_PATH_LENGTH_EXCEEDED',
  'PROXY_CERTIFICATES_NOT_ALLOWED',
  'DIFFERENT_CRL_SCOPE',
  'CRL_PATH_VALIDATION_ERROR',
]);

function asRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)
    : null;
}

function readString(error: unknown, key: string): string | undefined {
  const record = asRecord(error);
  const value = record?.[key];

  return typeof value === 'string' ? value : undefined;
}

function readNumber(error: unknown, key: string): number | undefined {
  const record = asRecord(error);
  const value = record?.[key];

  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readTrue(error: unknown, key: string): boolean {
  const record = asRecord(error);

  return record?.[key] === true;
}

function isTlsCode(code: string | undefined): boolean {
  if (code === undefined) {
    return false;
  }

  return (
    TLS_ERROR_CODES.has(code) ||
    code.startsWith('ERR_TLS') ||
    code.startsWith('ERR_SSL') ||
    code.startsWith('ERR_OSSL') ||
    code.startsWith('CERT_')
  );
}

/**
 * Maps an arbitrary library, TLS, socket or DNS error to one safe failure code.
 * The error message and any provider response are deliberately never inspected
 * for content and never leave the backend: only this classification does.
 */
export function classifyConnectionFailure(
  error: unknown,
): EmailVerificationFailureCode {
  if (error instanceof ConnectionTimeoutError) {
    return 'CONNECTION_TIMEOUT';
  }

  if (error instanceof MailDestinationError) {
    return error.failureCode;
  }

  const code = readString(error, 'code');
  const originalCode = readString(error, 'originalCode');
  const timeoutType = readString(error, 'timeoutType');
  const responseCode = readNumber(error, 'responseCode');

  if (
    readTrue(error, 'authenticationFailed') ||
    (code !== undefined && AUTHENTICATION_ERROR_CODES.has(code)) ||
    (responseCode !== undefined &&
      AUTHENTICATION_RESPONSE_CODES.has(responseCode))
  ) {
    return 'AUTHENTICATION_FAILED';
  }

  if (
    timeoutType !== undefined ||
    (code !== undefined && TIMEOUT_ERROR_CODES.has(code))
  ) {
    return 'CONNECTION_TIMEOUT';
  }

  if (code !== undefined && DNS_ERROR_CODES.has(code)) {
    return 'DNS_FAILURE';
  }

  if (code === 'ECONNREFUSED' || originalCode === 'ECONNREFUSED') {
    return 'CONNECTION_REFUSED';
  }

  if (
    readTrue(error, 'tlsFailed') ||
    isTlsCode(code) ||
    isTlsCode(originalCode)
  ) {
    return 'TLS_FAILURE';
  }

  return 'CONNECTION_FAILED';
}
