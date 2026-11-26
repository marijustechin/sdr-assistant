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

import type { EmailAccount } from '@/entities/email-account/client';
import { getToasts, toast } from '@/shared/lib/toast';

const { createEmailAccountAction, updateEmailAccountAction, push } = vi.hoisted(
  () => ({
    createEmailAccountAction: vi.fn(),
    updateEmailAccountAction: vi.fn(),
    push: vi.fn(),
  }),
);

vi.mock('../api/action', () => ({
  createEmailAccountAction,
  updateEmailAccountAction,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

afterEach(() => {
  cleanup();
  createEmailAccountAction.mockReset();
  updateEmailAccountAction.mockReset();
  push.mockReset();
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
