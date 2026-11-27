import { describe, expect, it } from 'vitest';

import type { EmailAccount } from '@/entities/email-account/client';

import {
  assignableEmailAccounts,
  resolveAssignedEmailAccount,
} from './research-settings';

function account(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: 'account-1',
    name: 'Outreach mailbox',
    senderName: 'Sales Team',
    emailAddress: 'sales@example.test',
    enabled: true,
    smtpHost: 'smtp.example.test',
    smtpPort: 587,
    smtpSecurity: 'STARTTLS',
    smtpUsername: 'smtp-user',
    smtpPasswordConfigured: true,
    imapHost: 'imap.example.test',
    imapPort: 993,
    imapSecurity: 'TLS',
    imapUsername: 'imap-user',
    imapPasswordConfigured: true,
    smtpVerificationStatus: 'NOT_TESTED',
    smtpLastCheckedAt: null,
    smtpVerificationFailureCode: null,
    imapVerificationStatus: 'NOT_TESTED',
    imapLastCheckedAt: null,
    imapVerificationFailureCode: null,
    createdAt: '2026-11-27T10:00:00.000Z',
    updatedAt: '2026-11-27T10:00:00.000Z',
    ...overrides,
  };
}

describe('resolveAssignedEmailAccount', () => {
  it('returns none for an unassigned research', () => {
    expect(resolveAssignedEmailAccount([account()], null)).toEqual({
      state: 'none',
    });
  });

  it('returns the assigned account, including a disabled one', () => {
    const disabled = account({ id: 'account-2', enabled: false });
    const resolved = resolveAssignedEmailAccount(
      [account(), disabled],
      'account-2',
    );

    expect(resolved).toEqual({ state: 'assigned', account: disabled });
  });

  it('reports a missing account without replacing the assignment', () => {
    expect(resolveAssignedEmailAccount([account()], 'deleted-account')).toEqual(
      {
        state: 'missing',
        emailAccountId: 'deleted-account',
      },
    );
  });
});

describe('assignableEmailAccounts', () => {
  it('offers only enabled accounts and keeps their source order', () => {
    const first = account({ id: 'account-1' });
    const disabled = account({ id: 'account-2', enabled: false });
    const third = account({ id: 'account-3' });

    expect(assignableEmailAccounts([first, disabled, third])).toEqual([
      first,
      third,
    ]);
  });

  it('returns an empty selection when no account is enabled', () => {
    expect(assignableEmailAccounts([account({ enabled: false })])).toEqual([]);
  });
});
