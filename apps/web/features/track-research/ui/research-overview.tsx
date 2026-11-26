import { Fragment } from 'react';

import type { ResearchResponse, ResearchResultView } from '@/entities/research';
import { PROFILING_SUMMARY_KEYS } from '@/entities/research/client';
import { formatDateTime } from '@/shared/lib/format';

import {
  PROFILING_SUMMARY_LABELS,
  resultAvailabilityMessage,
  unreadableDataMessage,
} from '../model/presentation';
import { RESEARCH_STATUS_LABELS } from './research-status-badge';

type ResearchOverviewProps = {
  research: ResearchResponse;
  result: ResearchResultView;
  productName: string;
  onOpenCompanies: () => void;
};

export function ResearchOverview({
  research,
  result,
  productName,
  onOpenCompanies,
}: ResearchOverviewProps) {
  const unreadable = unreadableDataMessage(result);

  return (
    <>
      <section className="card">
        <h2>Research details</h2>
        <dl className="data-list">
          <dt>Product</dt>
          <dd>{productName}</dd>
          <dt>Country</dt>
          <dd>{research.country}</dd>
          <dt>Execution status</dt>
          <dd>{RESEARCH_STATUS_LABELS[research.status]}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(research.createdAt)}</dd>
          <dt>Last updated</dt>
          <dd>{formatDateTime(research.updatedAt)}</dd>
          {research.lastHeartbeatAt !== null && (
            <>
              <dt>Last heartbeat</dt>
              <dd>{formatDateTime(research.lastHeartbeatAt)}</dd>
            </>
          )}
          {research.stage !== null && (
            <>
              <dt>Stage</dt>
              <dd>{research.stage}</dd>
            </>
          )}
          {research.error !== null && research.error !== '' && (
            <>
              <dt>Execution error</dt>
              <dd>{research.error}</dd>
            </>
          )}
          {result.completedThrough !== null && (
            <>
              <dt>Completion label</dt>
              <dd>
                {result.completedThrough}{' '}
                <span className="hint">(as stored)</span>
              </dd>
            </>
          )}
          {result.schemaVersion !== null && (
            <>
              <dt>Result schema version</dt>
              <dd>{result.schemaVersion}</dd>
            </>
          )}
          {result.resultsPerQuery !== null && (
            <>
              <dt>Query depth</dt>
              <dd>{result.resultsPerQuery}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <h2>Result availability</h2>
        <p>{resultAvailabilityMessage(result)}</p>

        {unreadable !== null && <p className="hint">{unreadable}</p>}

        {result.state === 'profiles' && (
          <div className="actions">
            <button
              type="button"
              className="button secondary small"
              onClick={onOpenCompanies}
            >
              Open companies
            </button>
          </div>
        )}
      </section>

      {result.summary !== null && (
        <section className="card">
          <h2>Profiling summary</h2>
          <dl className="data-list">
            {PROFILING_SUMMARY_KEYS.map((key) => {
              const value = result.summary?.[key];

              if (value === undefined) {
                return null;
              }

              return (
                <Fragment key={key}>
                  <dt>{PROFILING_SUMMARY_LABELS[key]}</dt>
                  <dd>{value}</dd>
                </Fragment>
              );
            })}
          </dl>
        </section>
      )}

      {result.legacyNote !== null && (
        <section className="card">
          <h2>Stored result note</h2>
          <p className="prose-block">{result.legacyNote}</p>
        </section>
      )}
    </>
  );
}
