'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { ResearchResponse } from '@/entities/research';
import {
  parseResearchResult,
  resumeResearch,
} from '@/entities/research/client';
import { formatDateTime, shortenId } from '@/shared/lib/format';
import { toast } from '@/shared/lib/toast';

import type { ResearchSection } from '../model/sections';
import { buildMarketSummary } from '../model/market-view';
import { useResearchPolling } from '../model/use-research-polling';
import { ResearchCompanies } from './research-companies';
import { ResearchContacts } from './research-contacts';
import { ResearchMarket } from './research-market';
import { ResearchMetrics, companiesWithContacts } from './research-metrics';
import { ResearchOverview } from './research-overview';
import { ResearchStatusBadge } from './research-status-badge';
import { ResearchTabs } from './research-tabs';

type ResearchWorkspaceProps = {
  initialResearch: ResearchResponse;
  productName: string;
};

const SPINNER_CLASSES =
  'inline-block size-4 animate-spin rounded-full border-2 border-border border-t-text motion-reduce:animate-none';

function toCopyText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2) ?? null;
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

/**
 * Owns the whole live view of one run: status, actions, metrics and the typed
 * sections. The result is rendered from the polled object, so a completed run
 * never needs a second request to show its data.
 */
export function ResearchWorkspace({
  initialResearch,
  productName,
}: ResearchWorkspaceProps) {
  const { research, isPolling, errorMessage, transientError, isStale, retry } =
    useResearchPolling(initialResearch);
  const result = useMemo(() => parseResearchResult(research), [research]);
  const marketSummary = useMemo(
    () =>
      result.state === 'profiles' || result.state === 'empty'
        ? buildMarketSummary(result.companies)
        : null,
    [result.state, result.companies],
  );
  const [selectedSection, setSelectedSection] =
    useState<ResearchSection | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  const isFailed =
    research.status === 'FAILED' || research.status === 'INTERRUPTED';
  const failureMessage = errorMessage ?? transientError;
  const canResume = isFailed || (isStale && isPolling);
  const showCheckAgain = !isPolling && (isFailed || failureMessage !== null);
  const hasResult = research.result !== null && research.result !== undefined;

  // Companies is the default section when profiles are available; an explicit
  // user choice always wins, and a run that completes while being watched does
  // not need an extra click to reveal its profiles.
  const section: ResearchSection =
    selectedSection ?? (result.state === 'profiles' ? 'companies' : 'overview');

  useEffect(() => {
    if (errorMessage === null) {
      return;
    }

    toast.error('Research updates stopped', {
      description: errorMessage,
      action: { label: 'Retry', onClick: retry },
    });
  }, [errorMessage, retry]);

  function selectSection(next: ResearchSection): void {
    setSelectedSection(next);
  }

  async function copyResult(): Promise<void> {
    const text = toCopyText(research.result);

    if (text === null) {
      return;
    }

    try {
      if (
        typeof navigator === 'undefined' ||
        navigator.clipboard === undefined
      ) {
        throw new Error('Clipboard is not available');
      }

      await navigator.clipboard.writeText(text);
      toast.success('Result copied to clipboard');
    } catch {
      toast.error('Could not copy the result', {
        action: {
          label: 'Try again',
          onClick: () => {
            void copyResult();
          },
        },
      });
    }
  }

  async function handleResume(): Promise<void> {
    setIsResuming(true);

    const resumed = await resumeResearch(research.id);

    if (!resumed.ok) {
      toast.error('Could not resume research', {
        description: resumed.message,
      });
      setIsResuming(false);
      return;
    }

    toast.success('Research resumed');
    retry();
    setIsResuming(false);
  }

  return (
    <>
      <header className="page-header research-header">
        <div>
          <h1>{productName}</h1>
          <p className="muted">
            {research.country} · created {formatDateTime(research.createdAt)} ·
            job {shortenId(research.id)}
          </p>

          <div className="research-status-row">
            <ResearchStatusBadge status={research.status} />

            {isPolling && (
              <span className={SPINNER_CLASSES} aria-hidden="true" />
            )}

            {research.stage !== null && (
              <span className="muted">{research.stage}</span>
            )}
          </div>

          <p
            className="muted research-status-message"
            role="status"
            aria-live="polite"
          >
            {statusMessage(isPolling, research.status)}
          </p>

          {isStale && isPolling && (
            <p className="hint">
              No update for two minutes — the run may be interrupted. Still
              checking.
            </p>
          )}

          {research.error !== null && research.error !== '' && (
            <pre className="error">{research.error}</pre>
          )}

          {failureMessage !== null && (
            <p className="form-error" role="alert">
              {failureMessage}
            </p>
          )}
        </div>

        <div className="actions research-header-actions">
          <Link
            href={`/products/${research.productId}`}
            className="button secondary"
          >
            Product page
          </Link>

          {hasResult && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void copyResult();
              }}
            >
              Copy
            </button>
          )}

          {canResume && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void handleResume();
              }}
              disabled={isResuming}
            >
              {isResuming ? 'Resuming…' : 'Resume research'}
            </button>
          )}

          {showCheckAgain && (
            <button type="button" className="button secondary" onClick={retry}>
              Check again
            </button>
          )}
        </div>
      </header>

      <ResearchMetrics result={result} />

      <ResearchTabs
        active={section}
        onChange={selectSection}
        counts={{
          companies:
            result.state === 'profiles' || result.state === 'empty'
              ? result.companies.length
              : null,
          market: marketSummary?.totalOffers ?? null,
          contacts: companiesWithContacts(result),
        }}
      />

      <div
        className="research-panel"
        role="tabpanel"
        id={`research-panel-${section}`}
        aria-labelledby={`research-tab-${section}`}
        tabIndex={0}
      >
        {section === 'overview' && (
          <ResearchOverview
            research={research}
            result={result}
            productName={productName}
            onOpenCompanies={() => selectSection('companies')}
          />
        )}

        {section === 'companies' && <ResearchCompanies result={result} />}

        {section === 'market' && <ResearchMarket result={result} />}

        {section === 'contacts' && <ResearchContacts result={result} />}
      </div>
    </>
  );
}
