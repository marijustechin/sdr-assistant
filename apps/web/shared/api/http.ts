import type { ZodError, ZodType } from 'zod';

import {
  describeRequestError,
  readErrorMessage,
  UNEXPECTED_RESPONSE_MESSAGE,
} from './errors';

/**
 * The single HTTP path of the app.
 *
 * Failures are values, not exceptions: everything resolves to `ApiResult`.
 * The one exception is a caller-initiated abort (`options.signal`), which is
 * re-thrown so callers can distinguish "unmounted" from "failed".
 */
export type ApiFailureReason =
  | 'network'
  | 'timeout'
  | 'http'
  /** 2xx, but the body is not JSON or does not match the schema. */
  | 'invalid-response';

export type ApiFailure = {
  ok: false;
  /** 0 for network failures and timeouts; the HTTP status otherwise. */
  status: number;
  reason: ApiFailureReason;
  /** Safe to show to a user. */
  message: string;
  /** Technical diagnostics; never rendered. */
  detail?: string;
};

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

const DEFAULT_TIMEOUT_MS = 10_000;

export type FetchOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    method = 'GET',
    body,
    headers,
  } = options;

  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  return fetch(url, {
    method,
    cache: 'no-store',
    signal: combined,
    headers:
      body === undefined
        ? headers
        : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function summariseZodError(error: ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

export async function requestJson<T>(
  url: string,
  schema: ZodType<T>,
  options: FetchOptions = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      const { message, detail } = await readErrorMessage(response);

      return {
        ok: false,
        status: response.status,
        reason: 'http',
        message,
        detail,
      };
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error) {
      return {
        ok: false,
        status: response.status,
        reason: 'invalid-response',
        message: UNEXPECTED_RESPONSE_MESSAGE,
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return {
        ok: false,
        status: response.status,
        reason: 'invalid-response',
        message: UNEXPECTED_RESPONSE_MESSAGE,
        detail: summariseZodError(parsed.error),
      };
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    const failure = describeRequestError(error);

    return {
      ok: false,
      status: 0,
      reason: failure.reason,
      message: failure.message,
      detail: failure.detail,
    };
  }
}

export function getJson<T>(
  url: string,
  schema: ZodType<T>,
  options: Omit<FetchOptions, 'method' | 'body'> = {},
): Promise<ApiResult<T>> {
  return requestJson(url, schema, { ...options, method: 'GET' });
}

export function postJson<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
  options: Omit<FetchOptions, 'method' | 'body'> = {},
): Promise<ApiResult<T>> {
  return requestJson(url, schema, { ...options, method: 'POST', body });
}

export function patchJson<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
  options: Omit<FetchOptions, 'method' | 'body'> = {},
): Promise<ApiResult<T>> {
  return requestJson(url, schema, { ...options, method: 'PATCH', body });
}
