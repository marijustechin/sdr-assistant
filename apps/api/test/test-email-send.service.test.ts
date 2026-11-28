import { randomBytes } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV,
  encryptCredential,
  parseEncryptionKey,
} from '../src/modules/email-accounts/credential-encryption';
import {
  MailDestinationError,
  type MailDestinationResolver,
  type ResolvedMailDestination,
} from '../src/modules/email-accounts/mail-destination';
import { SendTestEmailDto } from '../src/modules/outreach-email/dto/send-test-email.dto';
import { OutreachMessageBuilder } from '../src/modules/outreach-email/outreach-message.builder';
import type { ComposedOutreachEmail } from '../src/modules/outreach-email/outreach-email.types';
import type {
  SmtpMailSender,
  SmtpSendOutcome,
  SmtpSendTarget,
} from '../src/modules/outreach-email/smtp-mail-sender';
import { TestEmailSendService } from '../src/modules/outreach-email/test-email-send.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Synthetic fixtures only. The SMTP sender, the destination resolver and the
 * database are in-memory stand-ins, so no real email, DNS lookup, socket or
 * database connection is involved.
 */
const KEY_BASE64 = randomBytes(32).toString('base64');
const KEY = parseEncryptionKey(KEY_BASE64);
const PREVIOUS_KEY = process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];

const ATTACHMENT_BYTES = Buffer.from('synthetic attachment content', 'utf8');

type AccountRow = {
  id: string;
  senderName: string;
  emailAddress: string;
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: 'TLS' | 'STARTTLS';
  smtpUsername: string;
  smtpPasswordEncrypted: string;
  signatureName: string | null;
  signatureCompany: string | null;
  signaturePhone: string | null;
  signatureWebsite: string | null;
  signatureWhatsapp: string | null;
  signatureText: string | null;
};

type SettingsRow = {
  emailAccountId: string | null;
  initialEmailSubject: string | null;
  initialEmailBody: string | null;
};

type AttachmentRow = {
  filename: string;
  mimeType: string;
  content: Uint8Array;
};

type RecordData = {
  researchId: string;
  emailAccountId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  attachmentCount: number;
  status: 'SENT' | 'FAILED';
  failureCode: string | null;
  failureMessage: string | null;
};

function account(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'account-1',
    senderName: 'Ema Seller',
    emailAddress: 'sales@example.test',
    enabled: true,
    smtpHost: 'smtp.example.test',
    smtpPort: 587,
    smtpSecurity: 'STARTTLS',
    smtpUsername: 'smtp-user',
    smtpPasswordEncrypted: encryptCredential('synthetic-smtp-secret', KEY),
    signatureName: 'Best regards,',
    signatureCompany: 'Synthetic Trading',
    signaturePhone: '+370 6000 0000',
    signatureWebsite: 'https://example.test',
    signatureWhatsapp: 'https://wa.me/37060000000',
    signatureText: 'Monday to Friday',
    ...overrides,
  };
}

function settings(overrides: Partial<SettingsRow> = {}): SettingsRow {
  return {
    emailAccountId: 'account-1',
    initialEmailSubject: 'Supply partnership',
    initialEmailBody: 'Hello,\n\nWe would like to discuss supply.',
    ...overrides,
  };
}

const ATTACHMENT: AttachmentRow = {
  filename: 'price-list.pdf',
  mimeType: 'application/pdf',
  content: ATTACHMENT_BYTES,
};

type StoreOptions = {
  readonly researchExists?: boolean;
  readonly settings?: SettingsRow | null;
  readonly account?: AccountRow | null;
  readonly attachments?: readonly AttachmentRow[];
  readonly recordFails?: boolean;
};

function createStore(options: StoreOptions = {}) {
  const records: RecordData[] = [];
  const prisma = {
    research: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        options.researchExists === false ? null : { id: where.id },
    },
    researchCommunicationSettings: {
      findUnique: async () => options.settings ?? settings(),
    },
    emailAccount: {
      findUnique: async () => options.account ?? account(),
    },
    researchAttachment: {
      findMany: async () => options.attachments ?? [ATTACHMENT],
    },
    researchTestEmailSend: {
      create: async ({ data }: { data: RecordData }) => {
        if (options.recordFails === true) {
          throw Object.assign(new Error('relation does not exist'), {
            code: 'P2021',
          });
        }

        records.push(data);

        return { ...data, id: `record-${records.length}` };
      },
    },
  };

  return {
    prisma: prisma as unknown as PrismaService,
    records,
  };
}

type SendCall = {
  readonly message: ComposedOutreachEmail;
  readonly target: SmtpSendTarget;
};

function createSender(outcome: SmtpSendOutcome = { status: 'SENT' }): {
  readonly sender: SmtpMailSender;
  readonly calls: SendCall[];
} {
  const calls: SendCall[] = [];

  return {
    calls,
    sender: {
      send: async (message, target) => {
        calls.push({ message, target });

        return outcome;
      },
    },
  };
}

function createResolver(
  resolved: ResolvedMailDestination = {
    host: 'smtp.example.test',
    address: '203.0.113.10',
    family: 4,
  },
): {
  readonly resolver: MailDestinationResolver;
  readonly calls: string[];
} {
  const calls: string[] = [];

  return {
    calls,
    resolver: {
      resolve: async (host) => {
        calls.push(host);

        return resolved;
      },
    },
  };
}

function failingResolver(
  failureCode: 'DNS_FAILURE' | 'UNSAFE_DESTINATION',
): MailDestinationResolver {
  return {
    resolve: async () => {
      throw new MailDestinationError(failureCode, 'Synthetic resolver failure.');
    },
  };
}

function serviceFor(
  options: StoreOptions,
  sender: SmtpMailSender,
  resolver: MailDestinationResolver = createResolver().resolver,
) {
  const store = createStore(options);

  return {
    ...store,
    service: new TestEmailSendService(
      store.prisma,
      new OutreachMessageBuilder(),
      resolver,
      sender,
    ),
  };
}

beforeAll(() => {
  process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV] = KEY_BASE64;
});

afterAll(() => {
  if (PREVIOUS_KEY === undefined) {
    delete process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];
  } else {
    process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV] = PREVIOUS_KEY;
  }
});

describe('test email sending', () => {
  it('sends exactly one composed message through the assigned account', async () => {
    const { sender, calls } = createSender();
    const { resolver, calls: resolvedHosts } = createResolver();
    const { service, records } = serviceFor({}, sender, resolver);

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({
      outcome: 'SENT',
      recipient: 'test@example.test',
      recorded: true,
    });
    expect(resolvedHosts).toEqual(['smtp.example.test']);
    expect(calls).toHaveLength(1);

    const call = calls[0];

    expect(call?.message.from).toEqual({
      name: 'Ema Seller',
      address: 'sales@example.test',
    });
    expect(call?.message.to).toBe('test@example.test');
    expect(call?.message.subject).toBe('Supply partnership');
    expect(call?.message.text).toContain(
      'Best regards,\nEma Seller\nSynthetic Trading',
    );
    expect(call?.message.attachments[0]?.filename).toBe('price-list.pdf');
    expect(
      Buffer.from(call?.message.attachments[0]?.content ?? []).equals(
        ATTACHMENT_BYTES,
      ),
    ).toBe(true);
    expect(call?.target).toMatchObject({
      host: 'smtp.example.test',
      address: '203.0.113.10',
      port: 587,
      security: 'STARTTLS',
      username: 'smtp-user',
      password: 'synthetic-smtp-secret',
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      researchId: 'research-1',
      emailAccountId: 'account-1',
      senderEmail: 'sales@example.test',
      recipient: 'test@example.test',
      subject: 'Supply partnership',
      attachmentCount: 1,
      status: 'SENT',
      failureCode: null,
      failureMessage: null,
    });
  });

  it('records a definitive failure with a safe code and message', async () => {
    const { sender } = createSender({
      status: 'FAILED',
      failureCode: 'AUTHENTICATION_FAILED',
      message: 'The mail server rejected the saved username or password.',
      uncertain: false,
    });
    const { service, records } = serviceFor({}, sender);

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'AUTHENTICATION_FAILED',
      uncertain: false,
      message: 'The mail server rejected the saved username or password.',
    });
    expect(records[0]).toMatchObject({
      status: 'FAILED',
      failureCode: 'AUTHENTICATION_FAILED',
      failureMessage:
        'The mail server rejected the saved username or password.',
    });
  });

  it('reports an uncertain acceptance without retrying', async () => {
    const send = vi.fn(async () => ({
      status: 'FAILED' as const,
      failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN' as const,
      message: 'The mail server did not confirm acceptance.',
      uncertain: true,
    }));
    const { service, records } = serviceFor(
      {},
      { send },
      createResolver().resolver,
    );

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN',
      uncertain: true,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(records[0]).toMatchObject({
      status: 'FAILED',
      failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN',
    });
  });

  it('refuses to send without an assigned account', async () => {
    const { sender, calls } = createSender();
    const { service, records } = serviceFor(
      { settings: settings({ emailAccountId: null }) },
      sender,
    );

    await expect(
      service.send('research-1', 'test@example.test'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toHaveLength(0);
    expect(records).toHaveLength(0);
  });

  it('refuses to send before the initial email is saved', async () => {
    const { sender, calls } = createSender();
    const { service, records } = serviceFor(
      { settings: settings({ initialEmailSubject: null }) },
      sender,
    );

    await expect(
      service.send('research-1', 'test@example.test'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toHaveLength(0);
    expect(records).toHaveLength(0);
  });

  it('refuses to send from a disabled account', async () => {
    const { sender, calls } = createSender();
    const { service, records } = serviceFor(
      { account: account({ enabled: false }) },
      sender,
    );

    await expect(
      service.send('research-1', 'test@example.test'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toHaveLength(0);
    expect(records).toHaveLength(0);
  });

  it('rejects a research that does not exist', async () => {
    const { service, records } = serviceFor(
      { researchExists: false },
      createSender().sender,
    );

    await expect(
      service.send('missing', 'test@example.test'),
    ).rejects.toThrow(/not found/);
    expect(records).toHaveLength(0);
  });

  it('records an invalid SMTP port without attempting a connection', async () => {
    const { sender, calls } = createSender();
    const { service, records } = serviceFor(
      { account: account({ smtpPort: 2525 }) },
      sender,
    );

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'INVALID_CONFIGURATION',
      uncertain: false,
    });
    expect(calls).toHaveLength(0);
    expect(records[0]).toMatchObject({
      status: 'FAILED',
      failureCode: 'INVALID_CONFIGURATION',
    });
  });

  it('records an unsafe or unresolvable destination without sending', async () => {
    const { sender, calls } = createSender();
    const { service, records } = serviceFor(
      {},
      sender,
      failingResolver('UNSAFE_DESTINATION'),
    );

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'UNSAFE_DESTINATION',
    });
    expect(calls).toHaveLength(0);
    expect(records[0]).toMatchObject({
      failureCode: 'UNSAFE_DESTINATION',
    });
  });

  it('records an unavailable credential without sending', async () => {
    const { sender, calls } = createSender();
    const { service, records } = serviceFor(
      { account: account({ smtpPasswordEncrypted: 'v1.corrupted' }) },
      sender,
    );

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'CREDENTIAL_UNAVAILABLE',
      uncertain: false,
    });
    expect(calls).toHaveLength(0);
    expect(records[0]).toMatchObject({
      status: 'FAILED',
      failureCode: 'CREDENTIAL_UNAVAILABLE',
    });
  });

  it('prevents a duplicate submission while a send is in flight', async () => {
    let resolveSend: ((outcome: SmtpSendOutcome) => void) | undefined;
    const pending = new Promise<SmtpSendOutcome>((resolve) => {
      resolveSend = resolve;
    });
    const send = vi.fn(async () => pending);
    const { service, records } = serviceFor(
      {},
      { send },
      createResolver().resolver,
    );

    const first = service.send('research-1', 'test@example.test');
    const second = service.send('research-1', 'test@example.test');

    await expect(second).rejects.toBeInstanceOf(ConflictException);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    resolveSend?.({ status: 'SENT' });
    await expect(first).resolves.toMatchObject({ outcome: 'SENT' });
    expect(records).toHaveLength(1);
  });

  it('still reports the send result when the attempt cannot be recorded', async () => {
    const { service, records } = serviceFor({ recordFails: true }, createSender().sender);

    const result = await service.send('research-1', 'test@example.test');

    expect(result).toMatchObject({ outcome: 'SENT', recorded: false });
    expect(records).toHaveLength(0);
  });
});

describe('SendTestEmailDto validation', () => {
  async function errorsFor(payload: Record<string, unknown>) {
    return validate(plainToInstance(SendTestEmailDto, payload));
  }

  it('accepts and trims a valid recipient', async () => {
    const dto = plainToInstance(SendTestEmailDto, {
      recipient: '  test+label@example.test  ',
    });

    expect(dto.recipient).toBe('test+label@example.test');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ['not-an-email'],
    [''],
    ['   '],
    ['test@'],
    ['@example.test'],
    [`${'x'.repeat(310)}@example.test`],
  ])('rejects the invalid recipient %j', async (recipient) => {
    const errors = await errorsFor({ recipient });

    expect(errors.map((error) => error.property)).toContain('recipient');
  });
});
