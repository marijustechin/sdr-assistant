/** Message used when a 2xx response cannot be turned into a typed value. */
export const UNEXPECTED_RESPONSE_MESSAGE =
  'The API returned an unexpected response.';

const MAX_USER_MESSAGE_LENGTH = 200;
const MAX_DETAIL_LENGTH = 2_000;

export type ErrorInfo = {
  /** Safe to show to a user. Never contains HTML or a stack trace. */
  message: string;
  /** Technical diagnostics for logs; never rendered. */
  detail?: string;
};

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function describeUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Turns a Nest/Fastify error body into a single message.
 * Nest returns `{ statusCode, message, error }` where `message` is a string or
 * an array of validation messages.
 */
export function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const text = payload.trim();
    return text.length > 0 ? text : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const { message, error } = payload;

  if (Array.isArray(message)) {
    const parts = message.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    );
    return parts.length > 0 ? parts.join(', ') : null;
  }

  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }

  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }

  return null;
}

/**
 * Reads an error response once and separates a user-facing message from the
 * technical detail. HTML bodies, stack-trace-looking plain text and very long
 * bodies never become a user-facing message.
 */
export async function readErrorMessage(response: Response): Promise<ErrorInfo> {
  const fallback = `The API responded with HTTP ${response.status}.`;

  let text: string;

  try {
    text = await response.text();
  } catch (error) {
    return { message: fallback, detail: describeUnknown(error) };
  }

  const trimmed = text.trim();

  if (trimmed === '') {
    return { message: fallback };
  }

  const detail = truncate(trimmed, MAX_DETAIL_LENGTH);

  let payload: unknown;
  let parsed = true;

  try {
    payload = JSON.parse(trimmed);
  } catch {
    parsed = false;
    payload = undefined;
  }

  if (parsed) {
    const extracted = extractErrorMessage(payload);

    return extracted === null
      ? { message: fallback, detail }
      : { message: truncate(extracted, MAX_USER_MESSAGE_LENGTH), detail };
  }

  const looksLikeHtml = trimmed.startsWith('<');
  const isShortSingleLine =
    trimmed.length <= MAX_USER_MESSAGE_LENGTH && !trimmed.includes('\n');

  return !looksLikeHtml && isShortSingleLine
    ? { message: trimmed, detail }
    : { message: fallback, detail };
}

export type RequestErrorInfo = ErrorInfo & {
  reason: 'network' | 'timeout';
};

/** Maps a rejected fetch to a reason plus a user-facing message. */
export function describeRequestError(error: unknown): RequestErrorInfo {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return {
      reason: 'timeout',
      message: 'The API did not respond in time.',
      detail: 'TimeoutError',
    };
  }

  if (error instanceof TypeError) {
    return {
      reason: 'network',
      message: 'Could not reach the API. Is it running?',
      detail: describeUnknown(error),
    };
  }

  return {
    reason: 'network',
    message: 'Could not reach the API.',
    detail: describeUnknown(error),
  };
}
