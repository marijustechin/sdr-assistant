import {
  describeVerificationFailure,
  type ConnectionVerificationResult,
} from '@/entities/email-account/client';
import { toast } from '@/shared/lib/toast';

import type {
  EmailConnectionTestOutcome,
  EmailConnectionTestSummary,
} from '../api/action';

function protocolLabel(protocol: 'SMTP' | 'IMAP'): string {
  return protocol === 'SMTP' ? 'Outgoing (SMTP)' : 'Incoming (IMAP)';
}

function describeOutcome(outcome: EmailConnectionTestOutcome): string {
  if (!outcome.ok) {
    return `${protocolLabel(outcome.protocol)}: ${outcome.message}`;
  }

  const result: ConnectionVerificationResult = outcome.result;

  if (result.result === 'VERIFIED') {
    return `${protocolLabel(result.protocol)}: Verified`;
  }

  if (result.result === 'FAILED') {
    return `${protocolLabel(result.protocol)}: ${
      describeVerificationFailure(result.failureCode) ?? 'Failed'
    }`;
  }

  return `${protocolLabel(result.protocol)}: the saved configuration changed while testing`;
}

function isVerified(outcome: EmailConnectionTestOutcome): boolean {
  return outcome.ok && outcome.result.result === 'VERIFIED';
}

function needsAttention(outcome: EmailConnectionTestOutcome): boolean {
  return (
    !outcome.ok ||
    outcome.result.result === 'FAILED' ||
    outcome.result.result === 'CONFIGURATION_CHANGED'
  );
}

function notifySingle(outcome: EmailConnectionTestOutcome): void {
  if (!outcome.ok) {
    toast.error(`${protocolLabel(outcome.protocol)} test could not run`, {
      description: outcome.message,
    });

    return;
  }

  if (outcome.result.result === 'VERIFIED') {
    toast.success(`${protocolLabel(outcome.protocol)} connection verified`);

    return;
  }

  if (outcome.result.result === 'FAILED') {
    toast.error(`${protocolLabel(outcome.protocol)} connection failed`, {
      description:
        describeVerificationFailure(outcome.result.failureCode) ??
        'The connection test failed.',
    });

    return;
  }

  toast.warning('The saved configuration changed while testing', {
    description:
      'The test result was discarded. Save the account and test again.',
  });
}

/**
 * Turns one or two independent outcomes into the existing toast conventions:
 * success only when every requested protocol verified, a warning for partial
 * success or a discarded result, and an error when nothing verified.
 */
export function notifyConnectionTestSummary(
  summary: EmailConnectionTestSummary,
): void {
  const outcomes = summary.outcomes;

  if (outcomes.length === 1) {
    notifySingle(outcomes[0]);
    return;
  }

  const description = outcomes.map(describeOutcome).join(' · ');

  if (outcomes.every(isVerified)) {
    toast.success('Both connections verified');
    return;
  }

  if (outcomes.some(isVerified) && outcomes.some(needsAttention)) {
    toast.warning('One connection verified', { description });
    return;
  }

  if (outcomes.some((outcome) => !outcome.ok)) {
    toast.error('The connection tests could not complete', {
      description,
    });
    return;
  }

  toast.error('Connection tests failed', { description });
}
