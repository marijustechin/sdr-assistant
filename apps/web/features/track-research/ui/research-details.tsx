'use client';

import { useEffect, useState } from 'react';

import type { ResearchResponse } from '@/entities/research';
import { resumeResearch } from '@/entities/research/client';
import { toast } from '@/shared/lib/toast';

import { useResearchPolling } from '../model/use-research-polling';
import { ResearchResultView } from './research-result-view';
import { ResearchStatusBadge } from './research-status-badge';

type ResearchDetailsProps = {
  initialResearch: ResearchResponse;
};

const SPINNER_CLASSES =
  'inline-block size-4 animate-spin rounded-full border-2 border-border border-t-text motion-reduce:animate-none';

/**
 * Owns the whole live view of one run: status, errors and the result.
 *
 * The result is rendered from the polled object, not from a server re-render,
 * so a completed run never needs a second request to show its output.
 */
export function ResearchDetails({ initialResearch }: ResearchDetailsProps) {
  const { research, isPolling, errorMessage, transientError, isStale, retry } =
    useResearchPolling(initialResearch);
  const [isResuming, setIsResuming] = useState(false);

  const isFailed =
    research.status === 'FAILED' || research.status === 'INTERRUPTED';
  const failureMessage = errorMessage ?? transientError;
  const canResume = isFailed || (isStale && isPolling);

  async function handleResume(): Promise<void> {
    setIsResuming(true);

    const result = await resumeResearch(research.id);

    if (!result.ok) {
      toast.error('Could not resume research', {
        description: result.message,
      });
      setIsResuming(false);
      return;
    }

    toast.success('Research resumed');
    retry();
    setIsResuming(false);
  }

  // A toast is the page-level signal; the card below keeps the detail and the
  // Retry action, so a user who scrolled away still sees that polling stopped.
  useEffect(() => {
    if (errorMessage === null) {
      return;
    }

    toast.error('Research updates stopped', {
      description: errorMessage,
      action: { label: 'Retry', onClick: retry },
    });
  }, [errorMessage, retry]);

  return (
    <>
      <section className="card">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ResearchStatusBadge status={research.status} />

            {isPolling && (
              <span className={SPINNER_CLASSES} aria-hidden="true" />
            )}

            {research.stage !== null && (
              <span className="muted">{research.stage}</span>
            )}
          </div>

          <p className="muted" role="status" aria-live="polite">
            {statusMessage(isPolling, research.status)}
          </p>

          {isStale && isPolling && (
            <p className="hint">
              No update for two minutes — the run may be interrupted. Still
              checking.
            </p>
          )}

          {canResume && (
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => void handleResume()}
                disabled={isResuming}
              >
                {isResuming ? 'Resuming…' : 'Tęsti tyrimą'}
              </button>
            </div>
          )}

          {research.error !== null && research.error !== '' && (
            <pre className="error">{research.error}</pre>
          )}

          {failureMessage !== null && (
            <p className="form-error" role="alert">
              {failureMessage}
            </p>
          )}

          {!isPolling && (isFailed || failureMessage !== null) && (
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={retry}
              >
                Check again
              </button>
            </div>
          )}
        </div>
      </section>

      <ResearchResultView result={research.result} />
    </>
  );
}

function statusMessage(
  isPolling: boolean,
  status: ResearchResponse['status'],
): string {
  if (isPolling) {
    return status === 'QUEUED'
      ? 'Queued — waiting for a worker.'
      : 'Research is running…';
  }

  switch (status) {
    case 'COMPLETED':
      return 'Research completed.';
    case 'FAILED':
      return 'Research failed.';
    case 'INTERRUPTED':
      return 'Research was interrupted.';
    default:
      return 'Research is not running.';
  }
}
