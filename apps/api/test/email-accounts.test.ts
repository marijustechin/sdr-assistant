import { randomBytes } from 'node:crypto';

import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CredentialEncryptionError,
  EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV,
  decryptCredential,
  encryptCredential,
  parseEncryptionKey,
  readEncryptionKey,
} from '../src/modules/email-accounts/credential-encryption';
import { CreateEmailAccountDto } from '../src/modules/email-accounts/dto/create-email-account.dto';
import { UpdateEmailAccountDto } from '../src/modules/email-accounts/dto/update-email-account.dto';
import {
  toEmailAccountResponse,
  type EmailAccountRow,
} from '../src/modules/email-accounts/email-accounts.mapper';
import {
  EmailAccountsService,
  type EmailAccountCreateData,
  type EmailAccountUpdateData,
} from '../src/modules/email-accounts/email-accounts.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Synthetic credentials only. The key is generated per test run and is never
 * written anywhere; no database, SMTP or IMAP connection is involved.
 */
const KEY_BASE64 = randomBytes(32).toString('base64');
const KEY = parseEncryptionKey(KEY_BASE64);
const PREVIOUS_KEY = process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];

const CREATE_PAYLOAD = {
  name: 'Synthetic account',
  senderName: 'Synthetic Sender',
  emailAddress: 'sales@example.test',
  enabled: true,
  smtpHost: 'smtp.example.test',
  smtpPort: 587,
  smtpSecurity: 'STARTTLS',
  smtpUsername: 'smtp-user',
  smtpPassword: 'synthetic-smtp-secret',
  imapHost: 'imap.example.test',
  imapPort: 993,
  imapSecurity: 'TLS',
  imapUsername: 'imap-user',
  imapPassword: 'synthetic-imap-secret',
} as const;

function storedAccount(
  overrides: Partial<EmailAccountRow> = {},
): EmailAccountRow {
  return {
    id: 'account-1',
    name: 'Synthetic account',
    senderName: 'Synthetic Sender',
    emailAddress: 'sales@example.test',
    enabled: true,
    smtpHost: 'smtp.example.test',
    smtpPort: 587,
    smtpSecurity: 'STARTTLS',
    smtpUsername: 'smtp-user',
    smtpPasswordEncrypted: encryptCredential('synthetic-smtp-secret', KEY),
    imapHost: 'imap.example.test',
    imapPort: 993,
    imapSecurity: 'TLS',
    imapUsername: 'imap-user',
    imapPasswordEncrypted: encryptCredential('synthetic-imap-secret', KEY),
    smtpVerificationStatus: 'NOT_TESTED',
    smtpLastCheckedAt: null,
    smtpVerificationFailureCode: null,
    imapVerificationStatus: 'NOT_TESTED',
    imapLastCheckedAt: null,
    imapVerificationFailureCode: null,
    signatureName: null,
    signatureCompany: null,
    signaturePhone: null,
    signatureWebsite: null,
    signatureWhatsapp: null,
    signatureText: null,
    createdAt: new Date('2026-11-25T10:00:00.000Z'),
    updatedAt: new Date('2026-11-25T10:00:00.000Z'),
    ...overrides,
  };
}

type PrismaStore = {
  prisma: PrismaService;
  rows: Map<string, EmailAccountRow>;
  createArgs: EmailAccountCreateData[];
  updateArgs: { id: string; data: EmailAccountUpdateData }[];
};

/** Minimal in-memory stand-in for the Prisma delegate; never touches a database. */
function createPrismaStore(initial: readonly EmailAccountRow[] = []): PrismaStore {
  const rows = new Map(initial.map((row) => [row.id, row]));
  const createArgs: EmailAccountCreateData[] = [];
  const updateArgs: { id: string; data: EmailAccountUpdateData }[] = [];
  let sequence = 0;

  const emailAccount = {
    findMany: async ({ orderBy }: { orderBy: { createdAt: 'desc' } }) => {
      void orderBy;

      return [...rows.values()].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      rows.get(where.id) ?? null,
    create: async ({ data }: { data: EmailAccountCreateData }) => {
      sequence += 1;
      const now = new Date(Date.UTC(2026, 10, 25, 12, sequence));
      const row: EmailAccountRow = {
        id: `account-created-${sequence}`,
        ...data,
        smtpVerificationStatus: 'NOT_TESTED',
        smtpLastCheckedAt: null,
        smtpVerificationFailureCode: null,
        imapVerificationStatus: 'NOT_TESTED',
        imapLastCheckedAt: null,
        imapVerificationFailureCode: null,
        createdAt: now,
        updatedAt: now,
      };

      rows.set(row.id, row);
      createArgs.push(data);

      return row;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: EmailAccountUpdateData;
    }) => {
      const existing = rows.get(where.id);

      if (existing === undefined) {
        throw new Error(`No email account ${where.id}`);
      }

      const updated: EmailAccountRow = {
        ...existing,
        ...data,
        updatedAt: new Date(Date.UTC(2026, 10, 25, 18, sequence)),
      };

      rows.set(where.id, updated);
      updateArgs.push({ id: where.id, data });

      return updated;
    },
  };

  return {
    prisma: { emailAccount } as unknown as PrismaService,
    rows,
    createArgs,
    updateArgs,
  };
}

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('Expected the call to throw');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function flipBase64(value: string): string {
  return `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
}

function tamperWith(payload: string, partIndex: number): string {
  const parts = payload.split('.');

  parts[partIndex] = flipBase64(parts[partIndex] ?? '');

  return parts.join('.');
}

async function validateDto<T extends object>(
  type: new () => T,
  payload: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(type, payload));
}

function constraintMessages(errors: readonly ValidationError[]): string[] {
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

function propertyErrors(errors: readonly ValidationError[]): string[] {
  return errors.map((error) => error.property);
}

beforeEach(() => {
  process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV] = KEY_BASE64;
});

afterEach(() => {
  if (PREVIOUS_KEY === undefined) {
    delete process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];
  } else {
    process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV] = PREVIOUS_KEY;
  }
});

describe('email-account credential encryption', () => {
  it('round-trips a synthetic credential', () => {
    const payload = encryptCredential('synthetic-smtp-secret', KEY);

    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain('synthetic-smtp-secret');
    expect(decryptCredential(payload, KEY)).toBe('synthetic-smtp-secret');
  });

  it('uses a fresh random IV for every encryption of the same password', () => {
    const first = encryptCredential('synthetic-repeatable-secret', KEY);
    const second = encryptCredential('synthetic-repeatable-secret', KEY);

    expect(first).not.toBe(second);
    expect(first.split('.')[1]).not.toBe(second.split('.')[1]);
    expect(decryptCredential(first, KEY)).toBe('synthetic-repeatable-secret');
    expect(decryptCredential(second, KEY)).toBe('synthetic-repeatable-secret');
  });

  it('rejects a missing encryption key without echoing a value', () => {
    expect(() => parseEncryptionKey(undefined)).toThrow(
      CredentialEncryptionError,
    );
    expect(() => parseEncryptionKey('')).toThrow(
      /EMAIL_ACCOUNT_ENCRYPTION_KEY is not set/,
    );
    expect(() => readEncryptionKey({})).toThrow(CredentialEncryptionError);
  });

  it('rejects invalid encryption keys without echoing them', () => {
    const notBase64 = 'this is not base64!!';
    const shortKey = randomBytes(31).toString('base64');
    const longKey = randomBytes(33).toString('base64');

    expect(errorMessage(() => parseEncryptionKey(notBase64))).toContain(
      'Base64',
    );
    expect(errorMessage(() => parseEncryptionKey(notBase64))).not.toContain(
      notBase64,
    );
    expect(errorMessage(() => parseEncryptionKey(shortKey))).toContain(
      '32 bytes',
    );
    expect(errorMessage(() => parseEncryptionKey(longKey))).toContain(
      '32 bytes',
    );
  });

  it('rejects corrupted or foreign encrypted data', () => {
    const payload = encryptCredential('synthetic-tamper-secret', KEY);
    const foreignKey = parseEncryptionKey(randomBytes(32).toString('base64'));

    expect(() => decryptCredential(tamperWith(payload, 3), KEY)).toThrow(
      CredentialEncryptionError,
    );
    expect(() => decryptCredential(tamperWith(payload, 2), KEY)).toThrow(
      CredentialEncryptionError,
    );
    expect(() => decryptCredential(tamperWith(payload, 1), KEY)).toThrow(
      CredentialEncryptionError,
    );
    expect(() => decryptCredential('v1.broken', KEY)).toThrow(
      /Stored credential is corrupted/,
    );
    expect(() => decryptCredential('v2.a.b.c', KEY)).toThrow(
      /Stored credential is corrupted/,
    );
    expect(() => decryptCredential(payload, foreignKey)).toThrow(
      /could not be decrypted/,
    );
  });
});

describe('email-account response mapping', () => {
  it('returns credential-presence flags and no credential material', () => {
    const row = storedAccount();
    const response = toEmailAccountResponse(row);

    expect(response.smtpPasswordConfigured).toBe(true);
    expect(response.imapPasswordConfigured).toBe(true);
    expect(Object.keys(response).sort()).toEqual(
      [
        'id',
        'name',
        'senderName',
        'emailAddress',
        'enabled',
        'smtpHost',
        'smtpPort',
        'smtpSecurity',
        'smtpUsername',
        'smtpPasswordConfigured',
        'imapHost',
        'imapPort',
        'imapSecurity',
        'imapUsername',
        'imapPasswordConfigured',
        'smtpVerificationStatus',
        'smtpLastCheckedAt',
        'smtpVerificationFailureCode',
        'imapVerificationStatus',
        'imapLastCheckedAt',
        'imapVerificationFailureCode',
        'signature',
        'createdAt',
        'updatedAt',
      ].sort(),
    );

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain(row.smtpPasswordEncrypted);
    expect(serialized).not.toContain(row.imapPasswordEncrypted);
    expect(serialized).not.toContain('synthetic-smtp-secret');
    expect(serialized).not.toContain('synthetic-imap-secret');
    expect(response.createdAt).toBe('2026-11-25T10:00:00.000Z');
  });

  it('maps list and single-account reads without credentials', async () => {
    const row = storedAccount();
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);

    const list = await service.findAll();
    const single = await service.findOne(row.id);

    expect(list).toHaveLength(1);
    expect(single.id).toBe(row.id);

    for (const serialized of [
      JSON.stringify(list),
      JSON.stringify(single),
    ]) {
      expect(serialized).not.toContain('PasswordEncrypted');
      expect(serialized).not.toContain(row.smtpPasswordEncrypted);
      expect(serialized).not.toContain('synthetic-smtp-secret');
    }
  });
});

describe('email-account DTO validation', () => {
  it('accepts a complete synthetic account', async () => {
    const errors = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
    });

    expect(errors).toEqual([]);
  });

  it('requires both credentials when creating an account', async () => {
    const payload: Record<string, unknown> = { ...CREATE_PAYLOAD };

    delete payload.smtpPassword;
    delete payload.imapPassword;

    const errors = await validateDto(CreateEmailAccountDto, payload);

    expect(propertyErrors(errors)).toEqual(
      expect.arrayContaining(['smtpPassword', 'imapPassword']),
    );
  });

  it('rejects an invalid email address', async () => {
    const errors = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      emailAddress: 'not-an-email',
    });

    expect(propertyErrors(errors)).toContain('emailAddress');
    expect(constraintMessages(errors).join(' ')).toContain(
      'emailAddress must be an email address',
    );
  });

  it('rejects ports outside 1–65535 and accepts both bounds', async () => {
    const outOfRange = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      smtpPort: 0,
      imapPort: 65536,
    });

    expect(propertyErrors(outOfRange)).toEqual(
      expect.arrayContaining(['smtpPort', 'imapPort']),
    );

    const atBounds = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      smtpPort: 1,
      imapPort: 65535,
    });

    expect(atBounds).toEqual([]);
  });

  it('rejects unsupported security modes', async () => {
    const errors = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      smtpSecurity: 'NONE',
      imapSecurity: 'SSL',
    });

    expect(propertyErrors(errors)).toEqual(
      expect.arrayContaining(['smtpSecurity', 'imapSecurity']),
    );
  });

  it('rejects empty hosts, usernames and names', async () => {
    const errors = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      name: '   ',
      senderName: '',
      smtpHost: '',
      imapHost: '',
      smtpUsername: '',
      imapUsername: '',
    });

    expect(propertyErrors(errors)).toEqual(
      expect.arrayContaining([
        'name',
        'senderName',
        'smtpHost',
        'imapHost',
        'smtpUsername',
        'imapUsername',
      ]),
    );
  });

  it('treats an empty update password as "keep the stored credential"', async () => {
    const empty = plainToInstance(UpdateEmailAccountDto, {
      smtpPassword: '',
      imapPassword: '   ',
    });
    const replacement = plainToInstance(UpdateEmailAccountDto, {
      smtpPassword: ' rotated-secret ',
    });

    expect(empty.smtpPassword).toBeUndefined();
    expect(empty.imapPassword).toBeUndefined();
    expect(replacement.smtpPassword).toBe(' rotated-secret ');
  });

  it('validates partial updates without requiring the other fields', async () => {
    const errors = await validateDto(UpdateEmailAccountDto, {
      enabled: false,
    });

    expect(errors).toEqual([]);
  });

  it('rejects invalid partial updates', async () => {
    const errors = await validateDto(UpdateEmailAccountDto, {
      emailAddress: 'broken',
      smtpPort: 70000,
      imapSecurity: 'NONE',
    });

    expect(propertyErrors(errors)).toEqual(
      expect.arrayContaining(['emailAddress', 'smtpPort', 'imapSecurity']),
    );
  });
});

describe('email-account service', () => {
  it('encrypts both credentials before persisting and never returns them', async () => {
    const store = createPrismaStore();
    const service = new EmailAccountsService(store.prisma);
    const dto = plainToInstance(CreateEmailAccountDto, { ...CREATE_PAYLOAD });

    const created = await service.create(dto);
    const stored = store.rows.get(created.id);

    expect(created.smtpPasswordConfigured).toBe(true);
    expect(created.imapPasswordConfigured).toBe(true);
    expect(stored).toBeDefined();
    expect(stored?.smtpPasswordEncrypted).not.toContain(
      'synthetic-smtp-secret',
    );
    expect(decryptCredential(String(stored?.smtpPasswordEncrypted), KEY)).toBe(
      'synthetic-smtp-secret',
    );
    expect(decryptCredential(String(stored?.imapPasswordEncrypted), KEY)).toBe(
      'synthetic-imap-secret',
    );
    expect(JSON.stringify(created)).not.toContain('synthetic-smtp-secret');
    expect(store.createArgs).toHaveLength(1);
  });

  it('fails safely when the encryption key is missing or invalid', async () => {
    delete process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];

    const store = createPrismaStore();
    const service = new EmailAccountsService(store.prisma);
    const dto = plainToInstance(CreateEmailAccountDto, { ...CREATE_PAYLOAD });

    const failure = await service.create(dto).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).not.toBeNull();
    expect(messageOf(failure)).toContain('encryption is not configured');
    expect(messageOf(failure)).not.toContain(KEY_BASE64);
    expect(store.createArgs).toHaveLength(0);
    expect(store.rows.size).toBe(0);

    process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV] =
      'not-a-valid-encryption-key';

    const invalidFailure = await service.create(dto).then(
      () => null,
      (error: unknown) => error,
    );

    expect(invalidFailure).not.toBeNull();
    expect(messageOf(invalidFailure)).toContain('encryption is not configured');
    expect(store.createArgs).toHaveLength(0);
  });

  it('updates settings while retaining both stored credentials', async () => {
    const row = storedAccount();
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);
    const dto = plainToInstance(UpdateEmailAccountDto, {
      senderName: 'Updated Sender',
      enabled: false,
      smtpPort: 465,
      imapSecurity: 'STARTTLS',
    });

    const updated = await service.update(row.id, dto);
    const written = store.updateArgs.at(-1);
    const stored = store.rows.get(row.id);

    expect(updated.senderName).toBe('Updated Sender');
    expect(updated.enabled).toBe(false);
    expect(updated.smtpPort).toBe(465);
    expect(written?.data).not.toHaveProperty('smtpPasswordEncrypted');
    expect(written?.data).not.toHaveProperty('imapPasswordEncrypted');
    expect(stored?.smtpPasswordEncrypted).toBe(row.smtpPasswordEncrypted);
    expect(stored?.imapPasswordEncrypted).toBe(row.imapPasswordEncrypted);
    expect(updated.smtpPasswordConfigured).toBe(true);
    expect(updated.imapPasswordConfigured).toBe(true);
  });

  it('keeps the stored credentials when a password field is empty', async () => {
    const row = storedAccount();
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);
    const dto = plainToInstance(UpdateEmailAccountDto, {
      smtpPassword: '',
      imapPassword: '   ',
    });

    const updated = await service.update(row.id, dto);

    expect(updated.smtpPasswordConfigured).toBe(true);
    expect(updated.imapPasswordConfigured).toBe(true);
    expect(store.updateArgs).toHaveLength(0);
    expect(store.rows.get(row.id)?.smtpPasswordEncrypted).toBe(
      row.smtpPasswordEncrypted,
    );
  });

  it('replaces only the credential that received a new password', async () => {
    const row = storedAccount();
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);
    const dto = plainToInstance(UpdateEmailAccountDto, {
      smtpPassword: 'rotated-smtp-secret',
    });

    const updated = await service.update(row.id, dto);
    const stored = store.rows.get(row.id);
    const written = store.updateArgs.at(-1);

    expect(stored?.smtpPasswordEncrypted).not.toBe(row.smtpPasswordEncrypted);
    expect(decryptCredential(String(stored?.smtpPasswordEncrypted), KEY)).toBe(
      'rotated-smtp-secret',
    );
    expect(stored?.imapPasswordEncrypted).toBe(row.imapPasswordEncrypted);
    expect(written?.data).not.toHaveProperty('imapPasswordEncrypted');
    expect(updated.smtpPasswordConfigured).toBe(true);
    expect(JSON.stringify(updated)).not.toContain('rotated-smtp-secret');
    expect(stored?.smtpPasswordEncrypted).not.toContain(
      'rotated-smtp-secret',
    );
  });

  it('enables and disables an account without touching credentials', async () => {
    const row = storedAccount();
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);

    delete process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];

    const disabled = await service.update(
      row.id,
      plainToInstance(UpdateEmailAccountDto, { enabled: false }),
    );
    const enabled = await service.update(
      row.id,
      plainToInstance(UpdateEmailAccountDto, { enabled: true }),
    );

    expect(disabled.enabled).toBe(false);
    expect(enabled.enabled).toBe(true);
    expect(store.rows.get(row.id)?.smtpPasswordEncrypted).toBe(
      row.smtpPasswordEncrypted,
    );
  });

  it('reports a missing account as not found', async () => {
    const store = createPrismaStore();
    const service = new EmailAccountsService(store.prisma);

    await expect(
      service.update('missing', plainToInstance(UpdateEmailAccountDto, {})),
    ).rejects.toThrow(/not found/);
    await expect(service.findOne('missing')).rejects.toThrow(/not found/);
  });
});

describe('email-account signature', () => {
  it('maps every configured signature field, including both links', () => {
    const response = toEmailAccountResponse(
      storedAccount({
        signatureName: 'Sales Team',
        signatureCompany: 'Synthetic Trading',
        signaturePhone: '+370 6000 0000',
        signatureWebsite: 'https://example.test',
        signatureWhatsapp: 'https://wa.me/37060000000',
        signatureText: 'Monday to Friday',
      }),
    );

    expect(response.signature).toEqual({
      name: 'Sales Team',
      companyName: 'Synthetic Trading',
      phone: '+370 6000 0000',
      website: 'https://example.test',
      whatsapp: 'https://wa.me/37060000000',
      text: 'Monday to Friday',
    });
    expect(JSON.stringify(response)).not.toContain('PasswordEncrypted');
  });

  it('returns an all-null signature when nothing is configured', () => {
    expect(toEmailAccountResponse(storedAccount()).signature).toEqual({
      name: null,
      companyName: null,
      phone: null,
      website: null,
      whatsapp: null,
      text: null,
    });
  });

  it('stores a signature on creation and normalises blank values', async () => {
    const store = createPrismaStore();
    const service = new EmailAccountsService(store.prisma);
    const dto = plainToInstance(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      signatureName: ' Sales Team ',
      signatureCompany: '',
      signatureWebsite: 'https://example.test',
    });

    const created = await service.create(dto);
    const stored = store.rows.get(created.id);

    expect(created.signature).toEqual({
      name: 'Sales Team',
      companyName: null,
      phone: null,
      website: 'https://example.test',
      whatsapp: null,
      text: null,
    });
    expect(stored?.signatureName).toBe('Sales Team');
    expect(stored?.signatureCompany).toBeNull();
    expect(store.createArgs[0]?.signatureWebsite).toBe('https://example.test');
  });

  it('updates only the supplied signature fields and clears with null', async () => {
    const row = storedAccount({
      signatureName: 'Old name',
      signatureText: 'Keep this text',
    });
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);

    const updated = await service.update(
      row.id,
      plainToInstance(UpdateEmailAccountDto, {
        signatureName: null,
        signaturePhone: '+370 6000 0000',
      }),
    );

    expect(updated.signature.name).toBeNull();
    expect(updated.signature.phone).toBe('+370 6000 0000');
    expect(updated.signature.text).toBe('Keep this text');
    expect(store.updateArgs.at(-1)?.data).toEqual({
      signatureName: null,
      signaturePhone: '+370 6000 0000',
    });
  });

  it('never invalidates a protocol verification when only the signature changes', async () => {
    const row = storedAccount({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T09:00:00.000Z'),
      imapVerificationStatus: 'VERIFIED',
      imapLastCheckedAt: new Date('2026-11-26T09:01:00.000Z'),
    });
    const store = createPrismaStore([row]);
    const service = new EmailAccountsService(store.prisma);

    const updated = await service.update(
      row.id,
      plainToInstance(UpdateEmailAccountDto, {
        signatureText: 'New signature text',
      }),
    );
    const written = store.updateArgs.at(-1)?.data ?? {};

    expect(updated.smtpVerificationStatus).toBe('VERIFIED');
    expect(updated.imapVerificationStatus).toBe('VERIFIED');
    expect(written).not.toHaveProperty('smtpVerificationStatus');
    expect(written).not.toHaveProperty('imapVerificationStatus');
  });
});

describe('email-account signature DTO validation', () => {
  it('trims signature text and turns blank values into null', () => {
    const dto = plainToInstance(UpdateEmailAccountDto, {
      signatureName: '  Sales Team  ',
      signatureCompany: '   ',
      signatureWebsite: '',
      signatureWhatsapp: '  https://wa.me/37060000000  ',
      signatureText: '  Monday to Friday  ',
    });

    expect(dto.signatureName).toBe('Sales Team');
    expect(dto.signatureCompany).toBeNull();
    expect(dto.signatureWebsite).toBeNull();
    expect(dto.signatureWhatsapp).toBe('https://wa.me/37060000000');
    expect(dto.signatureText).toBe('Monday to Friday');
  });

  it('accepts optional signature fields on creation', async () => {
    const errors = await validateDto(CreateEmailAccountDto, {
      ...CREATE_PAYLOAD,
      signatureName: 'Sales Team',
      signatureWebsite: 'https://example.test',
      signatureWhatsapp: 'https://wa.me/37060000000',
      signatureCompany: null,
    });

    expect(errors).toEqual([]);
  });

  it('rejects non-HTTP signature links and over-long values', async () => {
    const errors = await validateDto(UpdateEmailAccountDto, {
      signatureWebsite: 'javascript:alert(1)',
      signatureWhatsapp: 'wa.me/37060000000',
      signatureName: 'x'.repeat(201),
      signatureText: 'x'.repeat(2001),
    });

    expect(propertyErrors(errors)).toEqual(
      expect.arrayContaining([
        'signatureWebsite',
        'signatureWhatsapp',
        'signatureName',
        'signatureText',
      ]),
    );
    expect(constraintMessages(errors).join(' ')).toContain(
      'signatureWebsite must be an http:// or https:// link',
    );
  });
});
