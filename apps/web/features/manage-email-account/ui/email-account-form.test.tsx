// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  ConnectionVerificationResult,
  EmailAccount,
} from '@/entities/email-account/client';
import { getToasts, toast } from '@/shared/lib/toast';

const {
  createEmailAccountAction,
  updateEmailAccountAction,
  testEmailAccountConnectionAction,
  push,
  refresh,
} = vi.hoisted(() => ({
  createEmailAccountAction: vi.fn(),
  updateEmailAccountAction: vi.fn(),
  testEmailAccountConnectionAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('../api/action', () => ({
  createEmailAccountAction,
  updateEmailAccountAction,
  testEmailAccountConnectionAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { EmailAccountForm } from './email-account-form';

const ACCOUNT: EmailAccount = {
  id: 'account-1',
  name: 'Synthetic account',
  senderName: 'Synthetic Sender',
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
  signature: {
    name: 'Best regards,',
    companyName: 'Synthetic Trading',
    phone: '+370 6000 0000',
    website: 'https://example.test',
    whatsapp: 'https://wa.me/37060000000',
    text: 'Monday to Friday',
  },
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

function verifiedResult(
  protocol: 'SMTP' | 'IMAP',
  account: EmailAccount = ACCOUNT,
): ConnectionVerificationResult {
  const lastCheckedAt = '2026-11-26T09:30:00.000Z';

  if (protocol === 'SMTP') {
    return {
      accountId: account.id,
      protocol,
      result: 'VERIFIED',
      failureCode: null,
      lastCheckedAt,
      account: {
        ...account,
        smtpVerificationStatus: 'VERIFIED',
        smtpLastCheckedAt: lastCheckedAt,
        smtpVerificationFailureCode: null,
      },
    };
  }

  return {
    accountId: account.id,
    protocol,
    result: 'VERIFIED',
    failureCode: null,
    lastCheckedAt,
    account: {
      ...account,
      imapVerificationStatus: 'VERIFIED',
      imapLastCheckedAt: lastCheckedAt,
      imapVerificationFailureCode: null,
    },
  };
}

function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('section');

  if (!(card instanceof HTMLElement)) {
    throw new Error(`Missing card for ${name}`);
  }

  return card;
}

afterEach(() => {
  cleanup();
  createEmailAccountAction.mockReset();
  updateEmailAccountAction.mockReset();
  testEmailAccountConnectionAction.mockReset();
  push.mockReset();
  refresh.mockReset();
  toast.clear();
});

describe('EmailAccountForm', () => {
  it('renders the general, SMTP and IMAP sections with editable defaults', () => {
    render(<EmailAccountForm mode="create" />);

    expect(screen.getByLabelText<HTMLInputElement>('Account name').value).toBe(
      '',
    );
    expect(screen.getByLabelText<HTMLInputElement>('SMTP port').value).toBe(
      '587',
    );
    expect(
      screen.getByLabelText<HTMLSelectElement>('SMTP security').value,
    ).toBe('STARTTLS');
    expect(screen.getByLabelText<HTMLInputElement>('IMAP port').value).toBe(
      '993',
    );
    expect(
      screen.getByLabelText<HTMLSelectElement>('IMAP security').value,
    ).toBe('TLS');
    expect(screen.getByLabelText<HTMLInputElement>('Enabled').checked).toBe(
      true,
    );
    expect(screen.getByLabelText<HTMLInputElement>('SMTP password').value).toBe(
      '',
    );
    expect(screen.getByLabelText<HTMLInputElement>('IMAP password').value).toBe(
      '',
    );
    expect(screen.getByRole('button', { name: 'Save account' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancel' })).toBeTruthy();
  });

  it('aligns the Enabled checkbox beside its label', () => {
    render(<EmailAccountForm mode="create" />);

    const checkbox = screen.getByLabelText<HTMLInputElement>('Enabled');
    const row = checkbox.parentElement;

    expect(row?.className).toContain('items-center');
    expect(row?.querySelector('label')?.htmlFor).toBe('email-account-enabled');
  });

  it('places the SMTP and IMAP cards side by side on wide screens', () => {
    render(<EmailAccountForm mode="create" />);

    expect(cardFor('Outgoing mail (SMTP)').parentElement?.className).toContain(
      'lg:grid-cols-2',
    );
    expect(cardFor('Incoming mail (IMAP)').parentElement?.className).toContain(
      'lg:grid-cols-2',
    );
  });

  it('renders the optional signature fields of an existing account', () => {
    render(<EmailAccountForm mode="edit" account={ACCOUNT} />);

    expect(
      screen.getByLabelText<HTMLInputElement>('Closing greeting').value,
    ).toBe('Best regards,');
    expect(screen.getByLabelText<HTMLInputElement>('Company name').value).toBe(
      'Synthetic Trading',
    );
    expect(
      screen.getByLabelText<HTMLInputElement>('Telephone number').value,
    ).toBe('+370 6000 0000');
    expect(screen.getByLabelText<HTMLInputElement>('Website link').value).toBe(
      'https://example.test',
    );
    expect(screen.getByLabelText<HTMLInputElement>('WhatsApp link').value).toBe(
      'https://wa.me/37060000000',
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Additional signature text')
        .value,
    ).toBe('Monday to Friday');
  });

  it('starts with empty signature fields on creation', () => {
    render(<EmailAccountForm mode="create" />);

    expect(
      screen.getByLabelText<HTMLInputElement>('Closing greeting').value,
    ).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Website link').value).toBe(
      '',
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Additional signature text')
        .value,
    ).toBe('');
  });

  it('initializes both usernames from the email address on creation', () => {
    render(<EmailAccountForm mode="create" />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'new.mailbox@example.test' },
    });

    expect(screen.getByLabelText<HTMLInputElement>('SMTP username').value).toBe(
      'new.mailbox@example.test',
    );
    expect(screen.getByLabelText<HTMLInputElement>('IMAP username').value).toBe(
      'new.mailbox@example.test',
    );
  });

  it('does not overwrite a customized username when the email changes again', () => {
    render(<EmailAccountForm mode="create" />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'first@example.test' },
    });
    fireEvent.change(screen.getByLabelText('SMTP username'), {
      target: { value: 'custom-smtp-user' },
    });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'second@example.test' },
    });

    expect(screen.getByLabelText<HTMLInputElement>('SMTP username').value).toBe(
      'custom-smtp-user',
    );
    expect(screen.getByLabelText<HTMLInputElement>('IMAP username').value).toBe(
      'second@example.test',
    );
  });

  it('never rewrites usernames automatically in edit mode', () => {
    render(<EmailAccountForm mode="edit" account={ACCOUNT} />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'changed@example.test' },
    });

    expect(screen.getByLabelText<HTMLInputElement>('SMTP username').value).toBe(
      'smtp-user',
    );
    expect(screen.getByLabelText<HTMLInputElement>('IMAP username').value).toBe(
      'imap-user',
    );
  });

  it('disables connection tests for a new account and explains why', () => {
    render(<EmailAccountForm mode="create" />);

    expect(
      screen.getByRole('button', { name: 'Test SMTP connection' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Test IMAP connection' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Save this account before testing the connections.'),
    ).toBeTruthy();
  });

  it('disables connection tests while unsaved changes exist', () => {
    render(<EmailAccountForm mode="edit" account={ACCOUNT} />);

    expect(
      screen.getByRole('button', { name: 'Test SMTP connection' }),
    ).toHaveProperty('disabled', false);

    fireEvent.change(screen.getByLabelText('Sender name'), {
      target: { value: 'Edited Sender' },
    });

    expect(
      screen.getByRole('button', { name: 'Test SMTP connection' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Save your changes before testing the connections.'),
    ).toBeTruthy();
  });

  it('disables connection tests for a disabled account', () => {
    render(
      <EmailAccountForm mode="edit" account={{ ...ACCOUNT, enabled: false }} />,
    );

    expect(
      screen.getByRole('button', { name: 'Test SMTP connection' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Enable the account before testing the connections.'),
    ).toBeTruthy();
  });

  it('shows the saved verification results of both protocols', () => {
    render(
      <EmailAccountForm
        mode="edit"
        account={{
          ...ACCOUNT,
          smtpVerificationStatus: 'VERIFIED',
          smtpLastCheckedAt: '2026-11-26T09:15:00.000Z',
          imapVerificationStatus: 'FAILED',
          imapLastCheckedAt: '2026-11-26T09:16:00.000Z',
          imapVerificationFailureCode: 'AUTHENTICATION_FAILED',
        }}
      />,
    );

    expect(screen.getByText(/SMTP · Verified/)).toBeTruthy();
    expect(screen.getByText(/IMAP · Failed/)).toBeTruthy();
    expect(
      screen.getByText('The server rejected the saved username or password.'),
    ).toBeTruthy();
    expect(screen.getByText(/Last checked 2026-11-26 11:15/)).toBeTruthy();
  });

  it('runs the individual SMTP test from the edit form', async () => {
    testEmailAccountConnectionAction.mockResolvedValue({
      outcomes: [
        {
          protocol: 'SMTP',
          ok: true,
          result: verifiedResult('SMTP'),
        },
      ],
    });

    render(<EmailAccountForm mode="edit" account={ACCOUNT} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Test SMTP connection' }),
    );

    await waitFor(() => {
      expect(testEmailAccountConnectionAction).toHaveBeenCalledWith(
        'account-1',
        'SMTP',
      );
      expect(getToasts()[0]?.title).toBe('Outgoing (SMTP) connection verified');
    });
    expect(testEmailAccountConnectionAction).toHaveBeenCalledTimes(1);
  });

  it('shows validation errors without calling the action', async () => {
    render(<EmailAccountForm mode="create" />);

    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

    expect(await screen.findByText('Account name is required.')).toBeTruthy();
    expect(screen.getByText('SMTP password is required.')).toBeTruthy();
    expect(screen.getByText('IMAP password is required.')).toBeTruthy();
    expect(createEmailAccountAction).not.toHaveBeenCalled();
    expect(getToasts()[0]?.title).toBe('Check the highlighted fields');
  });

  it('never populates passwords when editing an existing account', () => {
    render(<EmailAccountForm mode="edit" account={ACCOUNT} />);

    expect(screen.getByLabelText<HTMLInputElement>('Account name').value).toBe(
      'Synthetic account',
    );
    expect(screen.getByLabelText<HTMLInputElement>('SMTP password').value).toBe(
      '',
    );
    expect(screen.getByLabelText<HTMLInputElement>('IMAP password').value).toBe(
      '',
    );
    expect(
      screen.getByText(
        'The SMTP password is configured. Leave this field empty to keep it.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The IMAP password is configured. Leave this field empty to keep it.',
      ),
    ).toBeTruthy();
  });

  it('shows server failure feedback and a notification', async () => {
    updateEmailAccountAction.mockResolvedValue({
      status: 'error',
      message: 'The mailbox provider refused this account.',
    });

    render(<EmailAccountForm mode="edit" account={ACCOUNT} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

    expect(
      await screen.findByText('The mailbox provider refused this account.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(getToasts()[0]?.title).toBe('The email account was not saved');
    });
    expect(getToasts()[0]?.description).toBe(
      'The mailbox provider refused this account.',
    );
    expect(updateEmailAccountAction).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
