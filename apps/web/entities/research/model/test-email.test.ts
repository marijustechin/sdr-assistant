import { describe, expect, it } from 'vitest';

import { testEmailSendResultSchema } from './test-email';

describe('test email send result schema', () => {
  it('parses a successful outcome', () => {
    const parsed = testEmailSendResultSchema.parse({
      outcome: 'SENT',
      recipient: 'test@example.test',
      recorded: true,
      completedAt: '2026-11-28T16:00:00.000Z',
    });

    expect(parsed.outcome).toBe('SENT');
    expect(parsed.recipient).toBe('test@example.test');
  });

  it('parses a failed outcome with its uncertainty flag', () => {
    const parsed = testEmailSendResultSchema.parse({
      outcome: 'FAILED',
      recipient: 'test@example.test',
      failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN',
      message:
        'The mail server did not confirm acceptance. The message may or may not have been delivered.',
      uncertain: true,
      recorded: false,
      completedAt: '2026-11-28T16:00:00.000Z',
    });

    expect(parsed.outcome).toBe('FAILED');

    if (parsed.outcome === 'FAILED') {
      expect(parsed.failureCode).toBe('SMTP_ACCEPTANCE_UNCERTAIN');
      expect(parsed.uncertain).toBe(true);
    }
  });

  it('rejects an unknown outcome or a missing failure detail', () => {
    expect(
      testEmailSendResultSchema.safeParse({
        outcome: 'QUEUED',
        recipient: 'test@example.test',
      }).success,
    ).toBe(false);

    expect(
      testEmailSendResultSchema.safeParse({
        outcome: 'FAILED',
        recipient: 'test@example.test',
        uncertain: true,
        recorded: true,
        completedAt: '2026-11-28T16:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});
