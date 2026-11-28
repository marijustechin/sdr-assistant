// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EmailAccount } from '@/entities/email-account/client';
import type {
  AttachmentLimits,
  ResearchAttachment,
  ResearchInitialEmail,
} from '@/entities/research/client';
import { getToasts, toast } from '@/shared/lib/toast';

const {
  updateResearchEmailAccountAction,
  updateResearchInitialEmailAction,
  uploadResearchAttachmentAction,
  removeResearchAttachmentAction,
  sendTestEmailAction,
  refresh,
} = vi.hoisted(() => ({
  updateResearchEmailAccountAction: vi.fn(),
  updateResearchInitialEmailAction: vi.fn(),
  uploadResearchAttachmentAction: vi.fn(),
  removeResearchAttachmentAction: vi.fn(),
  sendTestEmailAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('../api/update-email-account-action', () => ({
  updateResearchEmailAccountAction,
}));

vi.mock('../api/update-initial-email-action', () => ({
  updateResearchInitialEmailAction,
}));

vi.mock('../api/attachment-actions', () => ({
  uploadResearchAttachmentAction,
  removeResearchAttachmentAction,
}));

vi.mock('../api/send-test-email-action', () => ({
  sendTestEmailAction,
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
import type {
  ResearchAttachmentsData,
  ResearchCommunicationSettingsData,
} from '../model/research-settings';

const EMPTY_SIGNATURE = {
  name: null,
  companyName: null,
  phone: null,
  website: null,
  whatsapp: null,
  text: null,
};

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
    signature: EMPTY_SIGNATURE,
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

const SIGNED = account({
  id: 'account-signed',
  name: 'Signed mailbox',
  emailAddress: 'signed@example.test',
  senderName: 'Ema Seller',
  signature: {
    name: 'Best regards,',
    companyName: 'Synthetic Trading',
    phone: '+370 6000 0000',
    website: 'https://example.test',
    whatsapp: 'https://wa.me/37060000000',
    text: 'Monday to Friday',
  },
});

const SAVED_INITIAL_EMAIL: ResearchInitialEmail = {
  subject: 'Supply partnership',
  body: 'Hello,\n\nWe would like to discuss supply.',
};

const LIMITS: AttachmentLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  maxAttachments: 5,
  maxTotalBytes: 25 * 1024 * 1024,
};

const ATTACHMENT: ResearchAttachment = {
  id: 'attachment-1',
  filename: 'price-list.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  sha256: 'a'.repeat(64),
  createdAt: '2026-11-27T10:05:00.000Z',
};

type ReadyCommunication = Extract<
  ResearchCommunicationSettingsData,
  { state: 'ready' }
>;

function readyCommunication(
  overrides: Partial<Omit<ReadyCommunication, 'state'>> = {},
): ReadyCommunication {
  return {
    state: 'ready',
    emailAccountId: null,
    initialEmail: null,
    accounts: [ENABLED, SECOND, DISABLED],
    ...overrides,
  };
}

type RenderOptions = {
  readonly communication?: ResearchCommunicationSettingsData;
  readonly attachments?: ResearchAttachmentsData;
  readonly onEmailAccountChange?: (emailAccountId: string | null) => void;
  readonly onInitialEmailChange?: (initialEmail: ResearchInitialEmail) => void;
  readonly onAttachmentsChange?: (
    attachments: readonly ResearchAttachment[],
  ) => void;
};

function renderSettings(options: RenderOptions = {}) {
  const onEmailAccountChange = options.onEmailAccountChange ?? vi.fn();
  const onInitialEmailChange = options.onInitialEmailChange ?? vi.fn();
  const onAttachmentsChange = options.onAttachmentsChange ?? vi.fn();

  render(
    <ResearchSettings
      researchId="research-1"
      communication={options.communication ?? readyCommunication()}
      attachments={
        options.attachments ?? {
          state: 'ready',
          limits: LIMITS,
          attachments: [],
        }
      }
      onEmailAccountChange={onEmailAccountChange}
      onInitialEmailChange={onInitialEmailChange}
      onAttachmentsChange={onAttachmentsChange}
    />,
  );

  return { onEmailAccountChange, onInitialEmailChange, onAttachmentsChange };
}

function optionTexts(select: HTMLSelectElement): string[] {
  return Array.from(select.options).map((option) => option.textContent ?? '');
}

afterEach(() => {
  cleanup();
  updateResearchEmailAccountAction.mockReset();
  updateResearchInitialEmailAction.mockReset();
  uploadResearchAttachmentAction.mockReset();
  removeResearchAttachmentAction.mockReset();
  sendTestEmailAction.mockReset();
  refresh.mockReset();
  toast.clear();
});

describe('ResearchSettings email account', () => {
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
      communication: readyCommunication({
        emailAccountId: ENABLED.id,
        accounts: [ENABLED],
      }),
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
      communication: readyCommunication({
        emailAccountId: ENABLED.id,
        accounts: [ENABLED],
      }),
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
      communication: readyCommunication({
        emailAccountId: DISABLED.id,
        accounts: [ENABLED, DISABLED],
      }),
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
      communication: readyCommunication({
        emailAccountId: 'deleted-account',
        accounts: [ENABLED],
      }),
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
      communication: readyCommunication({
        accounts: [DISABLED],
      }),
    });

    expect(
      screen.getByText(/No enabled email accounts are available/),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Manage email accounts' }),
    ).toBeTruthy();
  });
});

describe('ResearchSettings initial email', () => {
  it('shows empty fields when no initial email is saved', () => {
    renderSettings();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Initial email' }),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Subject').value).toBe('');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toBe(
      '',
    );
    expect(
      screen.getByRole('button', { name: 'Save initial email' }),
    ).toHaveProperty('disabled', true);
  });

  it('restores the saved subject and message', () => {
    renderSettings({
      communication: readyCommunication({
        initialEmail: SAVED_INITIAL_EMAIL,
      }),
    });

    expect(screen.getByLabelText<HTMLInputElement>('Subject').value).toBe(
      SAVED_INITIAL_EMAIL.subject,
    );
    expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toBe(
      SAVED_INITIAL_EMAIL.body,
    );
    expect(
      screen.getByRole('button', { name: 'Save initial email' }),
    ).toHaveProperty('disabled', false);
  });

  it('saves through the server action and reports the saved values', async () => {
    updateResearchInitialEmailAction.mockResolvedValue({
      ok: true,
      initialEmail: {
        subject: 'Trimmed subject',
        body: 'Trimmed body',
      },
    });
    const { onInitialEmailChange } = renderSettings();

    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: '  Trimmed subject  ' },
    });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: '  Trimmed body  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save initial email' }));

    await waitFor(() =>
      expect(updateResearchInitialEmailAction).toHaveBeenCalledWith(
        'research-1',
        '  Trimmed subject  ',
        '  Trimmed body  ',
      ),
    );
    await waitFor(() =>
      expect(onInitialEmailChange).toHaveBeenCalledWith({
        subject: 'Trimmed subject',
        body: 'Trimmed body',
      }),
    );
    expect(screen.getByLabelText<HTMLInputElement>('Subject').value).toBe(
      'Trimmed subject',
    );
    expect(getToasts().at(-1)?.title).toBe('Initial email saved');
  });

  it('does not save a blank subject or message', () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Subject only' },
    });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: '   ' },
    });

    expect(
      screen.getByRole('button', { name: 'Save initial email' }),
    ).toHaveProperty('disabled', true);
  });

  it('reports an API failure and keeps the draft', async () => {
    updateResearchInitialEmailAction.mockResolvedValue({
      ok: false,
      message: 'The initial email message is required.',
    });
    const { onInitialEmailChange } = renderSettings();

    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Subject' },
    });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Body' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save initial email' }));

    await waitFor(() =>
      expect(getToasts().at(-1)?.title).toBe(
        'Could not save the initial email',
      ),
    );
    expect(onInitialEmailChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>('Subject').value).toBe(
      'Subject',
    );
  });

  it('keeps the saved initial email when the account assignment changes', () => {
    renderSettings({
      communication: readyCommunication({
        emailAccountId: ENABLED.id,
        accounts: [ENABLED],
        initialEmail: SAVED_INITIAL_EMAIL,
      }),
    });

    expect(screen.getByLabelText<HTMLInputElement>('Subject').value).toBe(
      SAVED_INITIAL_EMAIL.subject,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove assignment' }));

    expect(screen.getByLabelText<HTMLTextAreaElement>('Message').value).toBe(
      SAVED_INITIAL_EMAIL.body,
    );
  });
});

describe('ResearchSettings signature and complete preview', () => {
  it('renders the assigned signature with clickable links and the complete email', () => {
    renderSettings({
      communication: readyCommunication({
        emailAccountId: SIGNED.id,
        accounts: [SIGNED],
        initialEmail: SAVED_INITIAL_EMAIL,
      }),
      attachments: {
        state: 'ready',
        limits: LIMITS,
        attachments: [ATTACHMENT],
      },
    });

    expect(
      screen.getByRole('heading', { level: 3, name: 'Signature' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Preview' }),
    ).toBeTruthy();

    // The signature is shown once alone and once inside the complete preview.
    expect(screen.getAllByText('Best regards,')).toHaveLength(2);
    expect(screen.getAllByText('Ema Seller')).toHaveLength(2);
    expect(screen.getAllByText('Synthetic Trading')).toHaveLength(2);
    expect(screen.getAllByText('+370 6000 0000')).toHaveLength(2);
    expect(screen.getAllByText('Monday to Friday')).toHaveLength(2);

    // Both blocks render the approved order: closing greeting, sender name,
    // company, telephone, website, WhatsApp and additional text last.
    const signatureBlocks = Array.from(
      document.querySelectorAll<HTMLElement>('.email-signature'),
    );

    expect(signatureBlocks).toHaveLength(2);

    for (const block of signatureBlocks) {
      const text = block.textContent ?? '';
      const positions = [
        'Best regards,',
        'Ema Seller',
        'Synthetic Trading',
        '+370 6000 0000',
        'https://example.test',
        'https://wa.me/37060000000',
        'Monday to Friday',
      ].map((value) => text.indexOf(value));

      expect(positions.every((index) => index >= 0)).toBe(true);
      expect([...positions].sort((left, right) => left - right)).toEqual(
        positions,
      );
    }

    const websiteLinks = screen.getAllByRole('link', {
      name: 'https://example.test',
    });

    expect(websiteLinks).toHaveLength(2);
    for (const link of websiteLinks) {
      expect(link.getAttribute('href')).toBe('https://example.test/');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }

    const whatsappLinks = screen.getAllByRole('link', {
      name: 'https://wa.me/37060000000',
    });

    expect(whatsappLinks).toHaveLength(2);
    expect(whatsappLinks[0]?.getAttribute('href')).toBe(
      'https://wa.me/37060000000',
    );

    // The complete preview carries the subject, the message and the attachment.
    expect(screen.getByText(SAVED_INITIAL_EMAIL.subject)).toBeTruthy();
    expect(
      screen.getAllByText(/We would like to discuss supply/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('price-list.pdf')).toHaveLength(2);
    expect(screen.getAllByText('2.0 KB')).toHaveLength(2);
    expect(screen.getByText('Attachments (1)')).toBeTruthy();
  });

  it('explains when the assigned account has no signature', () => {
    renderSettings({
      communication: readyCommunication({
        emailAccountId: ENABLED.id,
        accounts: [ENABLED],
      }),
    });

    expect(
      screen.getByText(
        'The assigned email account has no signature configured.',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Add a signature' })
        .getAttribute('href'),
    ).toBe(`/settings/email-accounts/${ENABLED.id}/edit`);
  });

  it('explains when no account is assigned', () => {
    renderSettings();

    expect(
      screen.getByText(
        'Assign an email account to reuse its signature in this email.',
      ),
    ).toBeTruthy();
  });

  it('does not render an unsafe stored link as an anchor', () => {
    const unsafe = account({
      id: 'account-unsafe',
      signature: {
        ...EMPTY_SIGNATURE,
        website: 'javascript:alert(1)',
      },
    });

    renderSettings({
      communication: readyCommunication({
        emailAccountId: unsafe.id,
        accounts: [unsafe],
      }),
    });

    expect(
      screen.queryByRole('link', { name: 'javascript:alert(1)' }),
    ).toBeNull();
    expect(screen.getAllByText('javascript:alert(1)').length).toBeGreaterThan(
      0,
    );
  });
});

describe('ResearchSettings attachments', () => {
  it('lists attachments with filename, size and a remove control', async () => {
    removeResearchAttachmentAction.mockResolvedValue({ ok: true });
    const { onAttachmentsChange } = renderSettings({
      attachments: {
        state: 'ready',
        limits: LIMITS,
        attachments: [ATTACHMENT],
      },
    });

    expect(screen.getAllByText('price-list.pdf')).toHaveLength(2);
    expect(screen.getAllByText('2.0 KB')).toHaveLength(2);

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove price-list.pdf' }),
    );

    await waitFor(() =>
      expect(removeResearchAttachmentAction).toHaveBeenCalledWith(
        'research-1',
        ATTACHMENT.id,
      ),
    );
    await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalledWith([]));
    expect(getToasts().at(-1)?.title).toBe('Attachment removed');
  });

  it('reports a removal failure and keeps the attachment', async () => {
    removeResearchAttachmentAction.mockResolvedValue({
      ok: false,
      message: 'Attachment attachment-1 not found',
    });
    const { onAttachmentsChange } = renderSettings({
      attachments: {
        state: 'ready',
        limits: LIMITS,
        attachments: [ATTACHMENT],
      },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove price-list.pdf' }),
    );

    await waitFor(() =>
      expect(getToasts().at(-1)?.title).toBe('The attachment was not removed'),
    );
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(screen.getAllByText('price-list.pdf')).toHaveLength(2);
  });

  it('uploads the selected file through the server action', async () => {
    uploadResearchAttachmentAction.mockResolvedValue({
      ok: true,
      attachment: ATTACHMENT,
    });
    const { onAttachmentsChange } = renderSettings();
    const file = new File(['synthetic-bytes'], 'price-list.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(screen.getByLabelText('Attachment file'), {
      target: { files: [file] },
    });
    expect(screen.getByText(/Selected: price-list.pdf/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Upload attachment' }));

    await waitFor(() =>
      expect(uploadResearchAttachmentAction).toHaveBeenCalledTimes(1),
    );

    const call = uploadResearchAttachmentAction.mock.calls[0];

    expect(call?.[0]).toBe('research-1');
    expect(call?.[1]).toBeInstanceOf(FormData);
    expect((call?.[1] as FormData).get('file')).toBe(file);

    await waitFor(() =>
      expect(onAttachmentsChange).toHaveBeenCalledWith([ATTACHMENT]),
    );
    expect(getToasts().at(-1)?.title).toBe('Attachment uploaded');
  });

  it('rejects a file above the configured per-file limit without uploading', () => {
    const { onAttachmentsChange } = renderSettings({
      attachments: {
        state: 'ready',
        limits: { ...LIMITS, maxFileBytes: 4 },
        attachments: [],
      },
    });
    const file = new File(['synthetic-bytes'], 'too-big.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(screen.getByLabelText('Attachment file'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload attachment' }));

    expect(getToasts().at(-1)?.title).toBe('The attachment was not uploaded');
    expect(getToasts().at(-1)?.description).toBe(
      'Each attachment must be at most 4 B.',
    );
    expect(uploadResearchAttachmentAction).not.toHaveBeenCalled();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it('reports a server-side upload failure and keeps the selection', async () => {
    uploadResearchAttachmentAction.mockResolvedValue({
      ok: false,
      message: 'An attachment file name must be at most 200 characters.',
    });
    const { onAttachmentsChange } = renderSettings();
    const file = new File(['synthetic-bytes'], 'price-list.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(screen.getByLabelText('Attachment file'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload attachment' }));

    await waitFor(() =>
      expect(getToasts().at(-1)?.title).toBe('The attachment was not uploaded'),
    );
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Selected: price-list.pdf/)).toBeTruthy();
  });

  it('renders an attachment load error with a retry action', () => {
    renderSettings({
      attachments: { state: 'error', message: 'The API is unavailable.' },
    });

    expect(screen.getByText('Could not load the attachments.')).toBeTruthy();
    expect(screen.getByText('The API is unavailable.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

const SENT_RESULT = {
  outcome: 'SENT' as const,
  recipient: 'test@example.test',
  recorded: true,
  completedAt: '2026-11-28T17:00:00.000Z',
} as const;

function readyToSendCommunication(): ResearchCommunicationSettingsData {
  return readyCommunication({
    emailAccountId: SIGNED.id,
    accounts: [SIGNED],
    initialEmail: SAVED_INITIAL_EMAIL,
  });
}

function renderReadyToSend() {
  return renderSettings({
    communication: readyToSendCommunication(),
    attachments: { state: 'ready', limits: LIMITS, attachments: [] },
  });
}

async function openTestEmailForm(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
  expect(await screen.findByLabelText('Test recipient')).toBeTruthy();
}

describe('ResearchSettings send test email', () => {
  it('keeps sending disabled until the composition is saved', () => {
    renderSettings();

    expect(
      screen.getByRole('button', { name: 'Send test email' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Save the initial email before sending a test.'),
    ).toBeTruthy();
  });

  it('enables sending from a saved composition and places the control below the preview', () => {
    renderReadyToSend();

    const button = screen.getByRole('button', { name: 'Send test email' });

    expect(button).toHaveProperty('disabled', false);

    const preview = document.querySelector('.email-preview');
    const sendBox = document.querySelector('.send-test-email');

    expect(preview).not.toBeNull();
    expect(sendBox).not.toBeNull();
    expect(preview?.nextElementSibling).toBe(sendBox);
  });

  it('requires saving unsaved composition changes before sending', () => {
    renderReadyToSend();

    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Unsaved subject' },
    });

    expect(
      screen.getByRole('button', { name: 'Send test email' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Save the initial email before sending a test.'),
    ).toBeTruthy();
  });

  it('refuses to send from a disabled assigned account', () => {
    renderSettings({
      communication: readyCommunication({
        emailAccountId: DISABLED.id,
        accounts: [DISABLED],
        initialEmail: SAVED_INITIAL_EMAIL,
      }),
      attachments: { state: 'ready', limits: LIMITS, attachments: [] },
    });

    expect(
      screen.getByRole('button', { name: 'Send test email' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Enable the assigned email account to send a test.'),
    ).toBeTruthy();
  });

  it('reveals the recipient form and cancels without sending', async () => {
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Test recipient')).toBeNull();
    expect(sendTestEmailAction).not.toHaveBeenCalled();
  });

  it('rejects an invalid recipient without calling the action', async () => {
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeTruthy();
    expect(sendTestEmailAction).not.toHaveBeenCalled();
  });

  it('sends once and displays the success result', async () => {
    sendTestEmailAction.mockResolvedValue({ ok: true, result: SENT_RESULT });
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: '  test@example.test  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    await waitFor(() =>
      expect(sendTestEmailAction).toHaveBeenCalledWith(
        'research-1',
        'test@example.test',
      ),
    );
    expect(
      await screen.findByText('Test email sent to test@example.test.'),
    ).toBeTruthy();
    expect(sendTestEmailAction).toHaveBeenCalledTimes(1);
  });

  it('shows sending progress and prevents a duplicate submission', async () => {
    let resolveSend: ((value: unknown) => void) | undefined;
    const pending = new Promise((resolve) => {
      resolveSend = resolve;
    });

    sendTestEmailAction.mockReturnValue(pending);
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: 'test@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    await waitFor(() => expect(sendTestEmailAction).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Sending test email…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sending…' })).toHaveProperty(
      'disabled',
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sending…' }));
    expect(sendTestEmailAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend?.({ ok: true, result: SENT_RESULT });
    });

    expect(
      await screen.findByText('Test email sent to test@example.test.'),
    ).toBeTruthy();
  });

  it('displays a definitive SMTP failure', async () => {
    sendTestEmailAction.mockResolvedValue({
      ok: true,
      result: {
        outcome: 'FAILED',
        recipient: 'test@example.test',
        failureCode: 'SMTP_REJECTED',
        message: 'The mail server rejected the test message (SMTP 550).',
        uncertain: false,
        recorded: true,
        completedAt: '2026-11-28T17:00:00.000Z',
      },
    });
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: 'test@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    expect(
      await screen.findByText(
        'The mail server rejected the test message (SMTP 550).',
      ),
    ).toBeTruthy();
  });

  it('displays an uncertain acceptance without claiming success', async () => {
    sendTestEmailAction.mockResolvedValue({
      ok: true,
      result: {
        outcome: 'FAILED',
        recipient: 'test@example.test',
        failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN',
        message:
          'The mail server did not confirm acceptance. The message may or may not have been delivered; check the mailbox before sending another test.',
        uncertain: true,
        recorded: true,
        completedAt: '2026-11-28T17:00:00.000Z',
      },
    });
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: 'test@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    expect(
      await screen.findByText(/may or may not have been delivered/),
    ).toBeTruthy();
    expect(screen.queryByText(/Test email sent to/)).toBeNull();
  });

  it('displays an API or precondition failure', async () => {
    sendTestEmailAction.mockResolvedValue({
      ok: false,
      message: 'Save the initial email before sending a test.',
    });
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: 'test@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    expect(
      await screen.findByText('Save the initial email before sending a test.'),
    ).toBeTruthy();
  });

  it('notes when the attempt could not be recorded', async () => {
    sendTestEmailAction.mockResolvedValue({
      ok: true,
      result: { ...SENT_RESULT, recorded: false },
    });
    renderReadyToSend();
    await openTestEmailForm();

    fireEvent.change(screen.getByLabelText('Test recipient'), {
      target: { value: 'test@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));

    expect(
      await screen.findByText(
        'The attempt could not be recorded in the database.',
      ),
    ).toBeTruthy();
  });
});
