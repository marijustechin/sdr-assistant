'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchResearchStatus } from '@/entities/research/client';
import type { ResearchResponse } from '@/entities/research';
import { describeRequestError } from '@/shared/api/errors';
import type { ApiFailure } from '@/shared/api/http';

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 8;
const STALE_AFTER_MS = 2 * 60 * 1_000;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'COMPLETED',
  'FAILED',
  'INTERRUPTED',
]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Retrying can only help for transport problems and server errors.
 * A 4xx (bad job id, deleted job) or a malformed payload will not change.
 */
export function isRetryableFailure(failure: ApiFailure): boolean {
  if (failure.reason === 'network' || failure.reason === 'timeout') {
    return true;
  }

  if (failure.reason === 'http') {
    return failure.status >= 500;
  }

  return false;
}

export type ResearchPollingState = {
  /** The latest successful read; carries `result` and `error` for rendering. */
  research: ResearchResponse;
  isPolling: boolean;
  /** Set when polling stopped because of a failure. */
  errorMessage: string | null;
  /** Last transient failure while still polling. */
  transientError: string | null;
  /** `RUNNING` without a fresh `updatedAt` — the run may be interrupted. */
  isStale: boolean;
  retry: () => void;
};

/**
 * Polls one research job until it reaches a terminal status.
 *
 * The hook owns both the status and the result: callers render them from
 * `research`, so a completed run never needs a second fetch to show its output.
 *
 * - stops on any terminal status;
 * - stops immediately on 4xx and on malformed payloads;
 * - retries transport errors and 5xx with exponential backoff (2→10 s, 8 tries);
 * - aborts on unmount; a caller abort is re-thrown by `shared/api/http`, so it is
 *   ignored here;
 * - state is reset by remounting: render the consumer with `key={research.id}`.
 */
export function useResearchPolling(
  initialResearch: ResearchResponse,
): ResearchPollingState {
  const [research, setResearch] = useState(initialResearch);
  const [isPolling, setIsPolling] = useState(
    () => !isTerminalStatus(initialResearch.status),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transientError, setTransientError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setErrorMessage(null);
    setTransientError(null);
    setIsPolling(true);
    setRetryToken((token) => token + 1);
  }, []);

  const { id, status } = initialResearch;

  useEffect(() => {
    // Nothing to do for a finished job, unless the user explicitly re-checked.
    if (isTerminalStatus(status) && retryToken === 0) {
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    function schedule(delayMs: number): void {
      timer = setTimeout(() => {
        void poll();
      }, delayMs);
    }

    function scheduleRetry(): void {
      schedule(Math.min(BASE_DELAY_MS * 2 ** (failures - 1), MAX_DELAY_MS));
    }

    async function poll(): Promise<void> {
      try {
        const result = await fetchResearchStatus(id, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        if (!result.ok) {
          if (!isRetryableFailure(result)) {
            setErrorMessage(result.message);
            setTransientError(null);
            setIsPolling(false);
            return;
          }

          failures += 1;
          setTransientError(result.message);

          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            setErrorMessage(result.message);
            setTransientError(null);
            setIsPolling(false);
            return;
          }

          scheduleRetry();
          return;
        }

        failures = 0;
        setTransientError(null);
        setResearch(result.data);
        setIsStale(
          Date.now() - Date.parse(result.data.updatedAt) > STALE_AFTER_MS,
        );

        if (isTerminalStatus(result.data.status)) {
          setIsPolling(false);
          return;
        }

        schedule(BASE_DELAY_MS);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        failures += 1;
        setTransientError(describeRequestError(error).message);

        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setErrorMessage(describeRequestError(error).message);
          setTransientError(null);
          setIsPolling(false);
          return;
        }

        scheduleRetry();
      }
    }

    void poll();

    return () => {
      controller.abort();

      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [id, status, retryToken]);

  return {
    research,
    isPolling,
    errorMessage,
    transientError,
    isStale,
    retry,
  };
}
