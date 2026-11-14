// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResearchResponse } from '@/entities/research';

const { fetchResearchStatus } = vi.hoisted(() => ({
  fetchResearchStatus: vi.fn(),
}));

vi.mock('@/entities/research/client', () => ({ fetchResearchStatus }));

// Imported after the mock so the hook receives the mocked module.
import { useResearchPolling } from './use-research-polling';

function research(overrides: Partial<ResearchResponse> = {}): ResearchResponse {
  return {
    id: 'job-1',
    productId: 'product-1',
    country: 'Lithuania',
    status: 'RUNNING',
    stage: 'product-identification',
    result: null,
    error: null,
    lastHeartbeatAt: null,
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

function networkFailure() {
  return {
    ok: false as const,
    status: 0,
    reason: 'network' as const,
    message: 'Could not reach the API. Is it running?',
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchResearchStatus.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useResearchPolling', () => {
  it('does not poll a job that is already terminal', () => {
    const { result } = renderHook(() =>
      useResearchPolling(research({ status: 'COMPLETED', result: 'done' })),
    );

    expect(result.current.isPolling).toBe(false);
    expect(fetchResearchStatus).not.toHaveBeenCalled();
  });

  it('stops at a terminal status and exposes the result from the same object', async () => {
    fetchResearchStatus.mockResolvedValueOnce({
      ok: true,
      data: research({ status: 'COMPLETED', result: 'done' }),
    });

    const { result } = renderHook(() => useResearchPolling(research()));

    await flush();

    expect(result.current.isPolling).toBe(false);
    expect(result.current.research.status).toBe('COMPLETED');
    expect(result.current.research.result).toBe('done');

    await advance(60_000);

    expect(fetchResearchStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps polling while the job is running', async () => {
    fetchResearchStatus
      .mockResolvedValueOnce({ ok: true, data: research() })
      .mockResolvedValueOnce({
        ok: true,
        data: research({ status: 'COMPLETED', result: 'done' }),
      });

    const { result } = renderHook(() => useResearchPolling(research()));

    await flush();
    expect(fetchResearchStatus).toHaveBeenCalledTimes(1);
    expect(result.current.isPolling).toBe(true);

    await advance(2_000);

    expect(fetchResearchStatus).toHaveBeenCalledTimes(2);
    expect(result.current.isPolling).toBe(false);
  });

  it('stops on a 4xx instead of retrying forever', async () => {
    fetchResearchStatus.mockResolvedValue({
      ok: false,
      status: 404,
      reason: 'http',
      message: 'Job not found',
    });

    const { result } = renderHook(() => useResearchPolling(research()));

    await flush();

    expect(result.current.isPolling).toBe(false);
    expect(result.current.errorMessage).toBe('Job not found');

    await advance(60_000);

    expect(fetchResearchStatus).toHaveBeenCalledTimes(1);
  });

  it('backs off and gives up after eight transient failures', async () => {
    fetchResearchStatus.mockResolvedValue(networkFailure());

    const { result } = renderHook(() => useResearchPolling(research()));

    await flush();
    expect(fetchResearchStatus).toHaveBeenCalledTimes(1);
    expect(result.current.transientError).toBe(
      'Could not reach the API. Is it running?',
    );

    for (const delay of [2_000, 4_000, 8_000, 10_000, 10_000, 10_000, 10_000]) {
      await advance(delay);
    }

    expect(fetchResearchStatus).toHaveBeenCalledTimes(8);
    expect(result.current.isPolling).toBe(false);
    expect(result.current.errorMessage).toBe(
      'Could not reach the API. Is it running?',
    );

    await advance(60_000);
    expect(fetchResearchStatus).toHaveBeenCalledTimes(8);
  });

  it('restarts polling after an explicit retry', async () => {
    fetchResearchStatus.mockResolvedValue(networkFailure());

    const { result } = renderHook(() => useResearchPolling(research()));

    await flush();

    for (const delay of [2_000, 4_000, 8_000, 10_000, 10_000, 10_000, 10_000]) {
      await advance(delay);
    }

    expect(result.current.isPolling).toBe(false);

    act(() => {
      result.current.retry();
    });
    await flush();

    expect(fetchResearchStatus).toHaveBeenCalledTimes(9);
    expect(result.current.errorMessage).toBeNull();
  });

  it('aborts the in-flight request on unmount', async () => {
    fetchResearchStatus.mockImplementation(() => new Promise(() => undefined));

    const { unmount } = renderHook(() => useResearchPolling(research()));

    await flush();

    const signal = fetchResearchStatus.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
