import type { ResearchStatus } from '@/entities/research';

const LABELS: Record<ResearchStatus, string> = {
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
      {LABELS[status]}
    </span>
  );
}
