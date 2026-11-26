import type { ResearchStatus } from '@/entities/research';

export const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  INTERRUPTED: 'Interrupted',
};

const TONES: Record<ResearchStatus, string> = {
  QUEUED: 'muted',
  RUNNING: 'muted',
  COMPLETED: 'ok',
  FAILED: 'error',
  INTERRUPTED: 'error',
};

export function ResearchStatusBadge({ status }: { status: ResearchStatus }) {
  return (
    <span className={`status ${TONES[status]}`}>
      <span className="dot" aria-hidden="true" />
      {RESEARCH_STATUS_LABELS[status]}
    </span>
  );
}
