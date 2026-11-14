import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { requestJson } from './http';

const schema = z.object({ value: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('requestJson', () => {
  it('parses a valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ value: 'ok' })),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toEqual({ ok: true, data: { value: 'ok' } });
  });

  it('turns Nest validation messages into one user message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            statusCode: 400,
            message: ['name should not be empty', 'country is invalid'],
            error: 'Bad Request',
          },
          400,
        ),
      ),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      reason: 'http',
      message: 'name should not be empty, country is invalid',
    });
  });

  it('never leaks an HTML error body to the user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><body>Internal Server Error</body></html>', {
          status: 500,
        }),
      ),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toMatchObject({
      ok: false,
      status: 500,
      reason: 'http',
      message: 'The API responded with HTTP 500.',
    });

    if (!result.ok) {
      expect(result.detail).toContain('<html>');
    }
  });

  it('does not classify broken JSON as a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not json', { status: 200 })),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toMatchObject({
      ok: false,
      status: 200,
      reason: 'invalid-response',
    });
    expect(result.ok === false && result.message).toBe(
      'The API returned an unexpected response.',
    );
  });

  it('reports a schema mismatch with the offending path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ value: 42 })),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toMatchObject({
      ok: false,
      status: 200,
      reason: 'invalid-response',
    });

    if (!result.ok) {
      expect(result.detail).toContain('value');
    }
  });

  it('reports network failures with status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toMatchObject({
      ok: false,
      status: 0,
      reason: 'network',
      message: 'Could not reach the API. Is it running?',
    });
  });

  it('reports timeouts separately from network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );

    const result = await requestJson('http://api.test/x', schema);

    expect(result).toMatchObject({
      ok: false,
      status: 0,
      reason: 'timeout',
      message: 'The API did not respond in time.',
    });
  });

  it('re-throws a caller-initiated abort', async () => {
    const controller = new AbortController();
    controller.abort();

    const abortError = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(
      requestJson('http://api.test/x', schema, { signal: controller.signal }),
    ).rejects.toBe(abortError);
  });
});
