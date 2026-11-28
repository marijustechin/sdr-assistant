/**
 * Configurable limits for research email attachments.
 *
 * The defaults are deliberately small: an initial outreach email carries a
 * handful of documents, not bulk files. Every value can be overridden through
 * the API environment; an absent, malformed or out-of-range value falls back to
 * the documented default instead of disabling the limit. The per-file limit is
 * also the raw request-body cap configured for attachment uploads.
 */
export type AttachmentLimits = {
  /** Maximum size of one attachment in bytes. */
  readonly maxFileBytes: number;
  /** Maximum number of attachments stored for one research. */
  readonly maxAttachments: number;
  /** Maximum sum of all attachment sizes of one research in bytes. */
  readonly maxTotalBytes: number;
};

export const ATTACHMENT_MAX_FILE_BYTES_ENV = 'ATTACHMENT_MAX_FILE_BYTES';
export const ATTACHMENT_MAX_ATTACHMENTS_ENV = 'ATTACHMENT_MAX_ATTACHMENTS';
export const ATTACHMENT_MAX_TOTAL_BYTES_ENV = 'ATTACHMENT_MAX_TOTAL_BYTES';

const MIB = 1024 * 1024;

export const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits = {
  maxFileBytes: 10 * MIB,
  maxAttachments: 5,
  maxTotalBytes: 25 * MIB,
};

/** Hard ceilings: a misconfiguration cannot lift a limit beyond these. */
const MAX_FILE_BYTES_CEILING = 50 * MIB;
const MAX_ATTACHMENTS_CEILING = 20;
const MAX_TOTAL_BYTES_CEILING = 100 * MIB;

function readLimit(
  raw: string | undefined,
  fallback: number,
  ceiling: number,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^[0-9]+$/.test(raw.trim())) return fallback;

  const parsed = Number(raw.trim());

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > ceiling) {
    return fallback;
  }

  return parsed;
}

/**
 * Reads the limits from the environment. `maxTotalBytes` is never smaller than
 * `maxFileBytes`, so a single attachment that passes the per-file check always
 * fits the remaining research budget on an empty research.
 */
export function readAttachmentLimits(
  env: NodeJS.ProcessEnv = process.env,
): AttachmentLimits {
  const maxFileBytes = readLimit(
    env[ATTACHMENT_MAX_FILE_BYTES_ENV],
    DEFAULT_ATTACHMENT_LIMITS.maxFileBytes,
    MAX_FILE_BYTES_CEILING,
  );
  const maxAttachments = readLimit(
    env[ATTACHMENT_MAX_ATTACHMENTS_ENV],
    DEFAULT_ATTACHMENT_LIMITS.maxAttachments,
    MAX_ATTACHMENTS_CEILING,
  );
  const maxTotalBytes = Math.max(
    readLimit(
      env[ATTACHMENT_MAX_TOTAL_BYTES_ENV],
      DEFAULT_ATTACHMENT_LIMITS.maxTotalBytes,
      MAX_TOTAL_BYTES_CEILING,
    ),
    maxFileBytes,
  );

  return { maxFileBytes, maxAttachments, maxTotalBytes };
}

/**
 * Raw request-body cap for one attachment request: the largest accepted file
 * plus headroom for the HTTP envelope. Fastify rejects a larger body before the
 * controller runs.
 */
export function attachmentRequestBodyLimitBytes(): number {
  return readAttachmentLimits().maxFileBytes + 64 * 1024;
}

/** Size in bytes as a short human-readable string, for error messages. */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MIB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / MIB).toFixed(1)} MB`;
}
