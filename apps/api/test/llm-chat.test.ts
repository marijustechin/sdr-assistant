import { afterEach, describe, expect, it, vi } from 'vitest';

import { LLM_CONFIG_FLASH } from '../src/modules/research/config/llm-config.js';
import {
  isInsufficientBalanceError,
  LlmRequestError,
  llmChat,
} from '../src/modules/research/lib/llm-chat.js';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function captureError(): Promise<unknown> {
  try {
    await llmChat(LLM_CONFIG_FLASH, 'system prompt', {});
  } catch (error) {
    return error;
  }

  throw new Error('llmChat did not throw');
}

describe('llmChat provider errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the status and provider error type of an insufficient balance answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              message: 'Insufficient Balance',
              type: 'insufficient_balance_error',
              code: 'invalid_request_error',
            },
          },
          402,
        ),
      ),
    );

    const error = await captureError();

    expect(error).toBeInstanceOf(LlmRequestError);
    expect(isInsufficientBalanceError(error)).toBe(true);
    expect((error as LlmRequestError).status).toBe(402);
    expect((error as LlmRequestError).providerErrorType).toBe(
      'insufficient_balance_error',
    );
    expect((error as LlmRequestError).providerErrorCode).toBe(
      'invalid_request_error',
    );
  });

  it('does not treat another 402 as an insufficient balance error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: { type: 'rate_limit_error' } }, 402),
      ),
    );

    const error = await captureError();

    expect(isInsufficientBalanceError(error)).toBe(false);
    expect((error as LlmRequestError).status).toBe(402);
  });

  it('does not treat a server error as an insufficient balance error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { type: 'server_error' } }, 500)),
    );

    const error = await captureError();

    expect(isInsufficientBalanceError(error)).toBe(false);
    expect((error as LlmRequestError).status).toBe(500);
  });

  it('keeps the status when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gateway timeout', { status: 504 })),
    );

    const error = await captureError();

    expect(error).toBeInstanceOf(LlmRequestError);
    expect((error as LlmRequestError).status).toBe(504);
    expect((error as LlmRequestError).providerErrorType).toBeNull();
    expect(isInsufficientBalanceError(error)).toBe(false);
  });
});
