'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchStage05Contacts,
  type Stage05Payload,
  type Stage05Result,
  type Stage05Run,
} from '@/entities/research/client';
import type { ApiFailure, ApiResult } from '@/shared/api/http';

export type Stage05ContactsState =
  | { phase: 'loading' }
  | { phase: 'none' }
  | { phase: 'error'; message: string }
  | { phase: 'running'; run: Stage05Run }
  | { phase: 'failed'; run: Stage05Run; message: string }
  | {
      phase: 'completed';
      run: Stage05Run;
      retained: Stage05Result[];
      excluded: Stage05Result[];
    };

type LoadedStage05 =
  | { phase: 'running'; run: Stage05Run }
  | { phase: 'failed'; run: Stage05Run; message: string }
  | {
      phase: 'completed';
      run: Stage05Run;
      retained: Stage05Result[];
      excluded: Stage05Result[];
    };

function failureMessage(failure: ApiFailure): string {
  return failure.message;
}

function splitResults(payload: Stage05Payload): LoadedStage05 {
  if (payload.run.status === 'QUEUED' || payload.run.status === 'RUNNING') {
    return { phase: 'running', run: payload.run };
  }
  if (payload.run.status === 'FAILED' || payload.run.status === 'INTERRUPTED') {
    return {
      phase: 'failed',
      run: payload.run,
      message: payload.run.error ?? 'Contact discovery did not complete.',
    };
  }
  return {
    phase: 'completed',
    run: payload.run,
    retained: payload.results.filter(
      (result) => result.decision === 'ACCEPTED',
    ),
    excluded: payload.results.filter(
      (result) => result.decision === 'EXCLUDED',
    ),
  };
}

/**
 * Loads the published Stage 05 aggregate. While the run is queued/running it
 * polls quietly; a 404 means no Stage 05 result exists yet. API failures are
 * values and never invent a completed state.
 */
export function useStage05Contacts(researchId: string): {
  state: Stage05ContactsState;
  retry: () => void;
} {
  const [state, setState] = useState<Stage05ContactsState>({
    phase: 'loading',
  });
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setState({ phase: 'loading' });
    setRetryToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(): Promise<void> {
      let result: ApiResult<Stage05Payload>;
      try {
        result = await fetchStage05Contacts(researchId);
      } catch {
        if (!active) return;
        setState({
          phase: 'error',
          message: 'Could not load Stage 05 contact discovery.',
        });
        return;
      }
      if (!active) return;

      if (!result.ok) {
        if (result.status === 404) {
          setState({ phase: 'none' });
        } else {
          setState({ phase: 'error', message: failureMessage(result) });
        }
        return;
      }

      const next = splitResults(result.data);
      if (next.phase === 'running') {
        setState(next);
        timer = setTimeout(() => {
          void load();
        }, 3_000);
        return;
      }
      setState(next);
    }

    void load();

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
    };
  }, [researchId, retryToken]);

  return { state, retry };
}
