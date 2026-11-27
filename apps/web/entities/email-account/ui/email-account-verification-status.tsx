import { formatDateTime } from '@/shared/lib/format';

import {
  describeVerificationFailure,
  verificationStatusLabel,
  type EmailConnectionProtocol,
  type EmailVerificationStatus,
} from '../model/schema';

type EmailAccountVerificationStatusProps = {
  readonly protocol: EmailConnectionProtocol;
  readonly status: EmailVerificationStatus;
  readonly lastCheckedAt: string | null;
  readonly failureCode: string | null;
};

function toneClass(status: EmailVerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'status ok';
    case 'FAILED':
      return 'status error';
    case 'NOT_TESTED':
      return 'status muted';
  }
}

/**
 * Historical verification state of one protocol. "Verified" is deliberately
 * used instead of "Connected": the result belongs to the saved configuration
 * that was tested, not to a live connection.
 *
 * Lives in the email-account entity because account assignment screens in more
 * than one feature present the same persisted result.
 */
export function EmailAccountVerificationStatus({
  protocol,
  status,
  lastCheckedAt,
  failureCode,
}: EmailAccountVerificationStatusProps) {
  const failure =
    status === 'FAILED' ? describeVerificationFailure(failureCode) : null;

  return (
    <div className="flex flex-col gap-1">
      <span className={toneClass(status)}>
        <span className="dot" aria-hidden="true" />
        {protocol} · {verificationStatusLabel(status)}
      </span>

      <span className="hint">
        {lastCheckedAt === null
          ? 'Not checked yet.'
          : `Last checked ${formatDateTime(lastCheckedAt)}`}
      </span>

      {failure !== null && <span className="hint text-error">{failure}</span>}
    </div>
  );
}
