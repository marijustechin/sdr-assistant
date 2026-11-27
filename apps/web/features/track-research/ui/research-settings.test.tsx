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

const { updateResearchEmailAccountAction, refresh } = vi.hoisted(() => ({
  updateResearchEmailAccountAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('../api/update-email-account-action', () => ({
  updateResearchEmailAccountAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ResearchSettings } from './research-settings';
import type { ResearchCommunicationSettingsData } from '../model/research-settings';

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

const ENABLED = account({
  smtpVerificationStatus: 'VERIFIED',
  smtpLastCheckedAt: '2026-11-26T09:30:00.000Z',
  imapVerificationStatus: 'FAILED',
  imapLastCheckedAt: '2026-11-26T09:31:00.000Z',
  imapVerificationFailureCode: 'AUTHENTICATION_FAILED',
});
const SECOND = account({
  id: 'account-2',
  name: 'Second mailbox',
  emailAddress: 'second@example.test',
});
const DISABLED = account({
  id: 'account-disabled',
  name: 'Disabled mailbox',
  emailAddress: 'disabled@example.test',
  enabled: false,
});

type RenderOptions = {
  readonly communication?: ResearchCommunicationSettingsData;
  readonly onEmailAccountChange?: (emailAccountId: string | null) => void;
};

function renderSettings(options: RenderOptions = {}) {
  const onEmailAccountChange = options.onEmailAccountChange ?? vi.fn();

  render(
    <ResearchSettings
      researchId="research-1"
      communication={
        options.communication ?? {
          state: 'ready',
          emailAccountId: null,
          accounts: [ENABLED, SECOND, DISABLED],
        }
      }
      onEmailAccountChange={onEmailAccountChange}
    />,
  );

  return { onEmailAccountChange };
}

function optionTexts(select: HTMLSelectElement): string[] {
  return Array.from(select.options).map((option) => option.textContent ?? '');
}

afterEach(() => {
  cleanup();
  updateResearchEmailAccountAction.mockReset();
  refresh.mockReset();
  toast.clear();
});

describe('ResearchSettings', () => {
  it('shows the unassigned state and offers only enabled accounts', () => {
    renderSettings();

    expect(
      screen.getByText('No email account is assigned to this research.'),
    ).toBeTruthy();

    const select = screen.getByLabelText<HTMLSelectElement>(
      'Assign an email account',
    );

    expect(optionTexts(select)).toEqual([
      'Select an enabled email account',
      `${ENABLED.name} — ${ENABLED.emailAddress}`,
      `${SECOND.name} — ${SECOND.emailAddress}`,
    ]);
    expect(
      screen.getByRole('button', { name: 'Assign account' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.queryByRole('button', { name: 'Remove assignment' }),
    ).toBeNull();
  });

  it('shows the assigned account, its address and both verification results', () => {
    renderSettings({
      communication: {
        state: 'ready',
        emailAccountId: ENABLED.id,
        accounts: [ENABLED],
      },
    });

    expect(screen.getByText(ENABLED.name)).toBeTruthy();
    expect(screen.getByText(ENABLED.emailAddress)).toBeTruthy();
    expect(screen.getByText('Enabled')).toBeTruthy();
    expect(screen.getByText(/SMTP · Verified/)).toBeTruthy();
    expect(screen.getByText(/IMAP · Failed/)).toBeTruthy();
    expect(
      screen.getByText('The server rejected the saved username or password.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove assignment' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change account' })).toBeTruthy();
  });

  it('assigns a selected enabled account through the server action', async () => {
    updateResearchEmailAccountAction.mockResolvedValue({
      ok: true,
      emailAccountId: SECOND.id,
    });
    const { onEmailAccountChange } = renderSettings();

    fireEvent.change(
      screen.getByLabelText<HTMLSelectElement>('Assign an email account'),
      { target: { value: SECOND.id } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign account' }));

    await waitFor(() =>
      expect(updateResearchEmailAccountAction).toHaveBeenCalledWith(
        'research-1',
        SECOND.id,
      ),
    );
    await waitFor(() =>
      expect(onEmailAccountChange).toHaveBeenCalledWith(SECOND.id),
    );
    expect(getToasts().at(-1)?.title).toBe('Email account assigned');
  });

  it('removes the assignment', async () => {
    updateResearchEmailAccountAction.mockResolvedValue({
      ok: true,
      emailAccountId: null,
    });
    const { onEmailAccountChange } = renderSettings({
      communication: {
        state: 'ready',
        emailAccountId: ENABLED.id,
        accounts: [ENABLED],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove assignment' }));

    await waitFor(() =>
      expect(updateResearchEmailAccountAction).toHaveBeenCalledWith(
        'research-1',
        null,
      ),
    );
    await waitFor(() =>
      expect(onEmailAccountChange).toHaveBeenCalledWith(null),
    );
    expect(getToasts().at(-1)?.title).toBe('Email account assignment removed');
  });

  it('keeps a disabled assigned account visible and out of the select', () => {
    renderSettings({
      communication: {
        state: 'ready',
        emailAccountId: DISABLED.id,
        accounts: [ENABLED, DISABLED],
      },
    });

    expect(screen.getByText(DISABLED.name)).toBeTruthy();
    expect(screen.getByText('Disabled')).toBeTruthy();
    expect(screen.getByText(/This account is disabled/)).toBeTruthy();

    const select = screen.getByLabelText<HTMLSelectElement>(
      'Change the assigned email account',
    );

    expect(optionTexts(select)).toEqual([
      'Select an enabled email account',
      `${ENABLED.name} — ${ENABLED.emailAddress}`,
    ]);
    expect(
      screen.getByRole('button', { name: 'Remove assignment' }),
    ).toBeTruthy();
  });

  it('reports a missing assigned account and keeps it removable', () => {
    renderSettings({
      communication: {
        state: 'ready',
        emailAccountId: 'deleted-account',
        accounts: [ENABLED],
      },
    });

    expect(
      screen.getByText('The assigned email account is no longer available.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove assignment' }),
    ).toBeTruthy();
  });

  it('reports an API failure without changing the assignment', async () => {
    updateResearchEmailAccountAction.mockResolvedValue({
      ok: false,
      message: 'Only enabled email accounts can be assigned',
    });
    const { onEmailAccountChange } = renderSettings();

    fireEvent.change(
      screen.getByLabelText<HTMLSelectElement>('Assign an email account'),
      { target: { value: SECOND.id } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign account' }));

    await waitFor(() =>
      expect(getToasts().at(-1)?.title).toBe(
        'Could not update the email account assignment',
      ),
    );
    expect(onEmailAccountChange).not.toHaveBeenCalled();
  });

  it('renders a load error with a retry action', () => {
    renderSettings({
      communication: {
        state: 'error',
        message: 'The API is unavailable.',
      },
    });

    expect(
      screen.getByText('Could not load the communication settings.'),
    ).toBeTruthy();
    expect(screen.getByText('The API is unavailable.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('explains when no enabled account exists', () => {
    renderSettings({
      communication: {
        state: 'ready',
        emailAccountId: null,
        accounts: [DISABLED],
      },
    });

    expect(
      screen.getByText(/No enabled email accounts are available/),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Manage email accounts' }),
    ).toBeTruthy();
  });
});
