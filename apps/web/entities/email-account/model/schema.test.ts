import { describe, expect, it } from 'vitest';

import {
  connectionVerificationResultSchema,
  describeVerificationFailure,
  emailAccountListSchema,
  emailAccountSchema,
  readEmailAccountForm,
  verificationStatusLabel,
} from './schema';

const ACCOUNT_RESPONSE = {
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
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

const VALID_FORM: Record<string, string> = {
  name: 'Synthetic account',
  senderName: 'Synthetic Sender',
  emailAddress: 'sales@example.test',
  enabled: 'on',
  smtpHost: 'smtp.example.test',
  smtpPort: '587',
  smtpSecurity: 'STARTTLS',
  smtpUsername: 'smtp-user',
  smtpPassword: 'synthetic-smtp-secret',
  imapHost: 'imap.example.test',
  imapPort: '993',
  imapSecurity: 'TLS',
  imapUsername: 'imap-user',
  imapPassword: 'synthetic-imap-secret',
};

function toFormData(values: Record<string, string>): FormData {
  const data = new FormData();

  for (const [name, value] of Object.entries(values)) {
    data.append(name, value);
  }

  return data;
}

describe('email-account response schemas', () => {
  it('accepts the wire shape and drops unknown credential fields', () => {
    const parsed = emailAccountSchema.parse({
      ...ACCOUNT_RESPONSE,
      smtpPasswordEncrypted: 'v1.iv.tag.ciphertext',
      imapPasswordEncrypted: 'v1.iv.tag.ciphertext',
    });

    expect(parsed.smtpPasswordConfigured).toBe(true);
    expect(parsed.imapPasswordConfigured).toBe(true);
    expect('smtpPasswordEncrypted' in parsed).toBe(false);
    expect('imapPasswordEncrypted' in parsed).toBe(false);
  });

  it('rejects a payload without the credential-presence flags', () => {
    const withoutFlags: Record<string, unknown> = { ...ACCOUNT_RESPONSE };

    delete withoutFlags.smtpPasswordConfigured;

    expect(emailAccountSchema.safeParse(withoutFlags).success).toBe(false);
  });

  it('parses a list of accounts', () => {
    const parsed = emailAccountListSchema.parse([
      ACCOUNT_RESPONSE,
      { ...ACCOUNT_RESPONSE, id: 'account-2', enabled: false },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[1].enabled).toBe(false);
  });

  it('parses independent verification states and timestamps', () => {
    const parsed = emailAccountSchema.parse({
      ...ACCOUNT_RESPONSE,
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: '2026-11-26T09:15:00.000Z',
      imapVerificationStatus: 'FAILED',
      imapLastCheckedAt: '2026-11-26T09:16:00.000Z',
      imapVerificationFailureCode: 'AUTHENTICATION_FAILED',
    });

    expect(parsed.smtpVerificationStatus).toBe('VERIFIED');
    expect(parsed.smtpLastCheckedAt).toBe('2026-11-26T09:15:00.000Z');
    expect(parsed.smtpVerificationFailureCode).toBeNull();
    expect(parsed.imapVerificationStatus).toBe('FAILED');
    expect(parsed.imapVerificationFailureCode).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects an unknown verification status', () => {
    expect(
      emailAccountSchema.safeParse({
        ...ACCOUNT_RESPONSE,
        smtpVerificationStatus: 'CONNECTED',
      }).success,
    ).toBe(false);
  });

  it('parses a verification result and keeps credential fields out', () => {
    const parsed = connectionVerificationResultSchema.parse({
      accountId: 'account-1',
      protocol: 'SMTP',
      result: 'FAILED',
      failureCode: 'CONNECTION_TIMEOUT',
      lastCheckedAt: '2026-11-26T09:20:00.000Z',
      account: {
        ...ACCOUNT_RESPONSE,
        smtpVerificationStatus: 'FAILED',
        smtpLastCheckedAt: '2026-11-26T09:20:00.000Z',
        smtpVerificationFailureCode: 'CONNECTION_TIMEOUT',
        smtpPasswordEncrypted: 'v1.iv.tag.ciphertext',
      },
    });

    expect(parsed.result).toBe('FAILED');
    expect(parsed.failureCode).toBe('CONNECTION_TIMEOUT');
    expect('smtpPasswordEncrypted' in parsed.account).toBe(false);
  });

  it('describes only known failure codes', () => {
    expect(describeVerificationFailure('AUTHENTICATION_FAILED')).toContain(
      'rejected the saved username or password',
    );
    expect(describeVerificationFailure('CONNECTION_TIMEOUT')).toContain(
      'did not respond',
    );
    expect(describeVerificationFailure('SOMETHING_NEW')).toBe(
      'The connection test failed.',
    );
    expect(describeVerificationFailure(null)).toBeNull();
  });

  it('labels the three verification states', () => {
    expect(verificationStatusLabel('NOT_TESTED')).toBe('Not tested');
    expect(verificationStatusLabel('VERIFIED')).toBe('Verified');
    expect(verificationStatusLabel('FAILED')).toBe('Failed');
  });
});

describe('readEmailAccountForm', () => {
  it('accepts a complete create form and sends numbers', () => {
    const result = readEmailAccountForm(toFormData(VALID_FORM), 'create');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected the form to be valid');
    }

    expect(result.input.smtpPort).toBe(587);
    expect(result.input.imapPort).toBe(993);
    expect(result.input.enabled).toBe(true);
    expect(result.input.smtpPassword).toBe('synthetic-smtp-secret');
    expect(result.input.imapPassword).toBe('synthetic-imap-secret');
  });

  it('marks an unchecked enabled box as disabled', () => {
    const values: Record<string, string> = { ...VALID_FORM };

    delete values.enabled;

    const result = readEmailAccountForm(toFormData(values), 'create');

    expect(result.ok && result.input.enabled).toBe(false);
  });

  it('requires both passwords when creating an account', () => {
    const values: Record<string, string> = { ...VALID_FORM };

    delete values.smtpPassword;
    delete values.imapPassword;

    const result = readEmailAccountForm(toFormData(values), 'create');

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('Expected the form to be invalid');
    }

    expect(result.fieldErrors.smtpPassword).toBe('SMTP password is required.');
    expect(result.fieldErrors.imapPassword).toBe('IMAP password is required.');
  });

  it('treats empty passwords on the edit form as unchanged', () => {
    const result = readEmailAccountForm(
      toFormData({
        ...VALID_FORM,
        smtpPassword: '',
        imapPassword: '   ',
      }),
      'edit',
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected the form to be valid');
    }

    expect(result.input.smtpPassword).toBeUndefined();
    expect(result.input.imapPassword).toBeUndefined();
  });

  it('reports invalid email, port and security values per field', () => {
    const result = readEmailAccountForm(
      toFormData({
        ...VALID_FORM,
        emailAddress: 'not-an-email',
        smtpPort: '70000',
        imapSecurity: 'NONE',
      }),
      'create',
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('Expected the form to be invalid');
    }

    expect(result.fieldErrors.emailAddress).toBe(
      'Enter a valid email address.',
    );
    expect(result.fieldErrors.smtpPort).toBe(
      'SMTP port must be between 1 and 65535.',
    );
    expect(result.fieldErrors.imapSecurity).toBeDefined();
  });

  it('reports missing required values', () => {
    const result = readEmailAccountForm(toFormData({}), 'create');

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('Expected the form to be invalid');
    }

    expect(result.fieldErrors.name).toBe('Account name is required.');
    expect(result.fieldErrors.smtpHost).toBe('SMTP host is required.');
    expect(result.fieldErrors.imapHost).toBe('IMAP host is required.');
  });

  it('keeps password whitespace but trims the other fields', () => {
    const result = readEmailAccountForm(
      toFormData({
        ...VALID_FORM,
        name: '  Synthetic account  ',
        smtpPassword: ' secret with spaces ',
      }),
      'create',
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected the form to be valid');
    }

    expect(result.input.name).toBe('Synthetic account');
    expect(result.input.smtpPassword).toBe(' secret with spaces ');
  });
});
