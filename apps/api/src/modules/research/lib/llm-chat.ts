import type { LLMConfig, DeepSeekResponse } from '../types.js';

export type LlmProvider = 'ds' | 'gemini';

/**
 * A single chat call never gets more than this.
 *
 * Without it a stalled connection hangs the request forever: stage 02 triages
 * pages one after another, so one silent socket freezes the whole run and the
 * job stays RUNNING with no progress. 90 s is well above the slowest normal
 * flash answer and well below a user's patience.
 */
const REQUEST_TIMEOUT_MS = 90_000;

/** Provider-side detail of a non-2xx answer. */
export type LlmProviderError = {
  readonly status: number;
  readonly type: string | null;
  readonly code: string | null;
};

/**
 * A provider answer that came back with a non-2xx status.
 *
 * The HTTP status and the provider's own `error.type` / `error.code` are kept,
 * because callers have to tell a transient page failure from a fatal account
 * problem: an exhausted balance must stop a whole run, while one bad page must
 * only fail that page.
 */
export class LlmRequestError extends Error {
  readonly status: number;
  readonly providerErrorType: string | null;
  readonly providerErrorCode: string | null;

  constructor(message: string, providerError: LlmProviderError) {
    super(message);
    this.name = 'LlmRequestError';
    this.status = providerError.status;
    this.providerErrorType = providerError.type;
    this.providerErrorCode = providerError.code;
  }
}

/**
 * The account has no balance left, so every further call would fail the same
 * way. Observed shape: HTTP 402 with
 * `{ "error": { "type": "insufficient_balance_error", "code": "invalid_request_error" } }`.
 */
export function isInsufficientBalanceError(error: unknown): boolean {
  return (
    error instanceof LlmRequestError &&
    error.status === 402 &&
    error.providerErrorType === 'insufficient_balance_error'
  );
}

/** Reads `error.type` / `error.code` out of a provider body, tolerating non-JSON. */
function readProviderError(body: string): {
  type: string | null;
  code: string | null;
} {
  const empty = { type: null, code: null };

  try {
    const parsed: unknown = JSON.parse(body);

    if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) {
      return empty;
    }

    const providerError = (parsed as { error: unknown }).error;

    if (typeof providerError !== 'object' || providerError === null) {
      return empty;
    }

    const { type, code } = providerError as { type?: unknown; code?: unknown };

    return {
      type: typeof type === 'string' ? type : null,
      code: typeof code === 'string' ? code : null,
    };
  } catch {
    return empty;
  }
}

export async function llmChat(
  config: LLMConfig,
  systemPrompt: string,
  userContent: object,
  provider: LlmProvider = 'ds',
): Promise<DeepSeekResponse> {
  const gemini = provider === 'gemini';
  const name = gemini ? 'Gemini' : 'DeepSeek';
  const endpoint = gemini
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://api.deepseek.com/chat/completions';
  const keyVariable = gemini ? 'GEMINI_API_KEY' : 'DEEPSEEK_API_KEY';
  const apiKey = process.env[keyVariable]?.trim();
  if (!apiKey) throw new Error(`Missing ${keyVariable}`);

  const model = gemini ? process.env.GEMINI_MODEL?.trim() : config.model;
  if (gemini && !model) throw new Error('Missing GEMINI_MODEL');
  const modelConfig = gemini
    ? { model, temperature: config.temperature, max_tokens: config.max_tokens }
    : config;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...modelConfig,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify(userContent),
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      const providerError = readProviderError(body);
      const label =
        providerError.type === null ? '' : ` (${providerError.type})`;

      throw new LlmRequestError(
        `${name} API error ${response.status}${label}: ${body.slice(0, 500)}`,
        { status: response.status, ...providerError },
      );
    }

    return (await response.json()) as DeepSeekResponse;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new Error(
        `${name} request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }

    throw error;
  }
}
