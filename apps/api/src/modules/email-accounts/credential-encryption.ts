import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption for stored email-account credentials.
 *
 * One credential becomes one opaque string: `v1.<iv>.<authTag>.<ciphertext>`,
 * all Base64. AES-256-GCM is used with a fresh random IV for every encryption,
 * so encrypting the same password twice yields two different payloads. The
 * authentication tag makes a tampered payload fail instead of decrypting to
 * garbage.
 *
 * The key comes only from `EMAIL_ACCOUNT_ENCRYPTION_KEY` (exactly 32 random
 * bytes, Base64). There is no default key and no plaintext fallback: a missing
 * or malformed key is rejected before any encryption or decryption happens.
 * Error messages never contain the key, the plaintext or ciphertext.
 */

export const EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV = 'EMAIL_ACCOUNT_ENCRYPTION_KEY';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const PAYLOAD_VERSION = 'v1';
const PART_SEPARATOR = '.';
const PART_COUNT = 4;

/** Canonical Base64, including the padding a 32-byte key produces. */
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** A credential could not be encrypted or decrypted safely. */
export class CredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialEncryptionError';
  }
}

function keyProblem(reason: string): CredentialEncryptionError {
  return new CredentialEncryptionError(
    `${EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV} ${reason}`,
  );
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw keyProblem(`must be ${KEY_LENGTH_BYTES} bytes.`);
  }
}

/**
 * Decodes and validates the configured key. Throws `CredentialEncryptionError`
 * when the variable is missing, is not Base64, or does not decode to exactly 32
 * bytes. The offending value is never echoed.
 */
export function parseEncryptionKey(raw: string | undefined): Buffer {
  if (raw === undefined || raw.trim() === '') {
    throw keyProblem('is not set.');
  }

  const value = raw.trim();

  if (!BASE64_PATTERN.test(value)) {
    throw keyProblem('must be Base64-encoded.');
  }

  const key = Buffer.from(value, 'base64');

  if (key.length !== KEY_LENGTH_BYTES) {
    throw keyProblem(`must decode to exactly ${KEY_LENGTH_BYTES} bytes.`);
  }

  if (key.toString('base64') !== value) {
    throw keyProblem('must be canonical Base64.');
  }

  return key;
}

/** Reads and validates the key from the environment. */
export function readEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  return parseEncryptionKey(env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV]);
}

/** Encrypts one credential into its stored representation. */
export function encryptCredential(plaintext: string, key: Buffer): string {
  assertKey(key);

  if (plaintext === '') {
    throw new CredentialEncryptionError('Cannot encrypt an empty credential.');
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return [
    PAYLOAD_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(PART_SEPARATOR);
}

function decodePart(part: string, expectedLength?: number): Buffer {
  if (!BASE64_PATTERN.test(part)) {
    throw new CredentialEncryptionError('Stored credential is corrupted.');
  }

  const value = Buffer.from(part, 'base64');

  if (expectedLength !== undefined && value.length !== expectedLength) {
    throw new CredentialEncryptionError('Stored credential is corrupted.');
  }

  return value;
}

/**
 * Decrypts a stored credential. A malformed payload, a tampered ciphertext, a
 * wrong authentication tag or a different key all fail with the same safe
 * error; no partial plaintext is ever returned.
 */
export function decryptCredential(payload: string, key: Buffer): string {
  assertKey(key);

  const parts = payload.split(PART_SEPARATOR);

  if (parts.length !== PART_COUNT || parts[0] !== PAYLOAD_VERSION) {
    throw new CredentialEncryptionError('Stored credential is corrupted.');
  }

  const iv = decodePart(parts[1], IV_LENGTH_BYTES);
  const authTag = decodePart(parts[2], AUTH_TAG_LENGTH_BYTES);
  const ciphertext = decodePart(parts[3]);

  if (ciphertext.length === 0) {
    throw new CredentialEncryptionError('Stored credential is corrupted.');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new CredentialEncryptionError('Stored credential could not be decrypted.');
  }
}
