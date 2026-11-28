import { z } from 'zod';

import { toHttpUrl } from '@/shared/lib/url';

/**
 * Wire contract of `GET/POST /email-accounts` and `GET/PATCH /email-accounts/:id`.
 *
 * The API never returns a credential: only `smtpPasswordConfigured` and
 * `imapPasswordConfigured` say whether one is stored. Unknown response fields
 * are dropped by zod, so no extra value can reach a component.
 */

export const emailSecurityModeSchema = z.enum(['TLS', 'STARTTLS']);

export type EmailSecurityMode = z.infer<typeof emailSecurityModeSchema>;

/**
 * The optional, reusable signature block of one account. Unset fields are
 * `null`. Website and WhatsApp are validated HTTP(S) links; every value is
 * plain text and is rendered as text, never as markup.
 */
export const emailAccountSignatureSchema = z.object({
  name: z.string().nullable(),
  companyName: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  whatsapp: z.string().nullable(),
  text: z.string().nullable(),
});

export type EmailAccountSignature = z.infer<typeof emailAccountSignatureSchema>;

/** True when at least one signature field carries visible text. */
export function hasSignatureContent(signature: EmailAccountSignature): boolean {
  return (
    signature.name !== null ||
    signature.companyName !== null ||
    signature.phone !== null ||
    signature.website !== null ||
    signature.whatsapp !== null ||
    signature.text !== null
  );
}

/**
 * A historical connection-test result. `NOT_TESTED` also describes a result
 * that a configuration change invalidated, and it is what a newly created
 * account starts with.
 */
export const emailVerificationStatusSchema = z.enum([
  'NOT_TESTED',
  'VERIFIED',
  'FAILED',
]);

export type EmailVerificationStatus = z.infer<
  typeof emailVerificationStatusSchema
>;

const verificationFailureCodeSchema = z.string().min(1).nullable();

export const emailAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  senderName: z.string().min(1),
  emailAddress: z.string().min(1),
  enabled: z.boolean(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int(),
  smtpSecurity: emailSecurityModeSchema,
  smtpUsername: z.string().min(1),
  smtpPasswordConfigured: z.boolean(),
  imapHost: z.string().min(1),
  imapPort: z.number().int(),
  imapSecurity: emailSecurityModeSchema,
  imapUsername: z.string().min(1),
  imapPasswordConfigured: z.boolean(),
  smtpVerificationStatus: emailVerificationStatusSchema,
  smtpLastCheckedAt: z.string().nullable(),
  smtpVerificationFailureCode: verificationFailureCodeSchema,
  imapVerificationStatus: emailVerificationStatusSchema,
  imapLastCheckedAt: z.string().nullable(),
  imapVerificationFailureCode: verificationFailureCodeSchema,
  signature: emailAccountSignatureSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EmailAccount = z.infer<typeof emailAccountSchema>;

export const emailAccountListSchema = z.array(emailAccountSchema);

export const emailConnectionProtocolSchema = z.enum(['SMTP', 'IMAP']);

export type EmailConnectionProtocol = z.infer<
  typeof emailConnectionProtocolSchema
>;

/**
 * Wire contract of `POST /email-accounts/:id/test-smtp|test-imap`.
 *
 * `CONFIGURATION_CHANGED` is returned when the saved configuration was edited
 * while the test ran; it is not a persisted result.
 */
export const connectionVerificationResultSchema = z.object({
  accountId: z.string().min(1),
  protocol: emailConnectionProtocolSchema,
  result: z.enum(['VERIFIED', 'FAILED', 'CONFIGURATION_CHANGED']),
  failureCode: verificationFailureCodeSchema,
  lastCheckedAt: z.string().nullable(),
  account: emailAccountSchema,
});

export type ConnectionVerificationResult = z.infer<
  typeof connectionVerificationResultSchema
>;

const VERIFICATION_FAILURE_MESSAGES: Record<string, string> = {
  AUTHENTICATION_FAILED: 'The server rejected the saved username or password.',
  CONNECTION_TIMEOUT: 'The server did not respond in time.',
  DNS_FAILURE: 'The host name could not be resolved.',
  CONNECTION_REFUSED: 'The server refused the connection.',
  TLS_FAILURE: 'TLS could not be established or the certificate was rejected.',
  INVALID_CONFIGURATION:
    'The saved settings cannot be used for a connection test.',
  UNSAFE_DESTINATION:
    'The host does not resolve to a public mail-server address.',
  CREDENTIAL_UNAVAILABLE: 'The saved password could not be decrypted.',
  CONNECTION_FAILED: 'The connection could not be established.',
};

/** Safe, human-readable text for one persisted failure code. */
export function describeVerificationFailure(
  failureCode: string | null,
): string | null {
  if (failureCode === null) {
    return null;
  }

  return (
    VERIFICATION_FAILURE_MESSAGES[failureCode] ?? 'The connection test failed.'
  );
}

export function verificationStatusLabel(
  status: EmailVerificationStatus,
): string {
  switch (status) {
    case 'VERIFIED':
      return 'Verified';
    case 'FAILED':
      return 'Failed';
    case 'NOT_TESTED':
      return 'Not tested';
  }
}

/** What the create/edit form sends; passwords are absent when unchanged. */
export type EmailAccountInput = {
  name: string;
  senderName: string;
  emailAddress: string;
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: EmailSecurityMode;
  smtpUsername: string;
  smtpPassword?: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: EmailSecurityMode;
  imapUsername: string;
  imapPassword?: string;
  signatureName: string | null;
  signatureCompany: string | null;
  signaturePhone: string | null;
  signatureWebsite: string | null;
  signatureWhatsapp: string | null;
  signatureText: string | null;
};

export type EmailAccountFormMode = 'create' | 'edit';

export type EmailAccountFormResult =
  | { ok: true; input: EmailAccountInput }
  | { ok: false; fieldErrors: Record<string, string> };

const MAX_PORT = 65535;

function nameField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(200, `${label} must be 200 characters or fewer.`);
}

function hostField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(253, `${label} must be 253 characters or fewer.`);
}

function usernameField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(320, `${label} must be 320 characters or fewer.`);
}

/** Ports arrive as form strings; the API receives numbers. */
function portField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} port is required.`)
    .regex(/^\d+$/, `${label} port must be a whole number.`)
    .transform((value) => Number(value))
    .pipe(
      z
        .number()
        .int()
        .min(1, `${label} port must be between 1 and ${MAX_PORT}.`)
        .max(MAX_PORT, `${label} port must be between 1 and ${MAX_PORT}.`),
    );
}

const emailAccountFieldsSchema = z.object({
  name: nameField('Account name'),
  senderName: nameField('Sender name'),
  emailAddress: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .max(320, 'Email address must be 320 characters or fewer.')
    .pipe(z.email('Enter a valid email address.')),
  smtpHost: hostField('SMTP host'),
  smtpPort: portField('SMTP'),
  smtpSecurity: emailSecurityModeSchema,
  smtpUsername: usernameField('SMTP username'),
  imapHost: hostField('IMAP host'),
  imapPort: portField('IMAP'),
  imapSecurity: emailSecurityModeSchema,
  imapUsername: usernameField('IMAP username'),
});

const MAX_PASSWORD_LENGTH = 1024;

const MAX_SIGNATURE_TEXT_LENGTH = 2000;
const MAX_SIGNATURE_LINK_LENGTH = 500;

/** Optional signature text: blank means "not configured", not an error. */
function signatureTextField(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/**
 * Optional signature link. A blank value clears it; anything else must be a
 * full HTTP(S) URL so the rendered email can never contain a `javascript:` or
 * other unsafe anchor target.
 */
function signatureLinkField(label: string) {
  return z
    .string()
    .trim()
    .max(
      MAX_SIGNATURE_LINK_LENGTH,
      `${label} must be ${MAX_SIGNATURE_LINK_LENGTH} characters or fewer.`,
    )
    .refine(
      (value) => value === '' || toHttpUrl(value) !== null,
      `${label} must be a full http:// or https:// link.`,
    );
}

const signatureFieldsSchema = z.object({
  signatureName: signatureTextField('Closing greeting', 200),
  signatureCompany: signatureTextField('Company name', 200),
  signaturePhone: signatureTextField('Telephone number', 50),
  signatureWebsite: signatureLinkField('Website link'),
  signatureWhatsapp: signatureLinkField('WhatsApp link'),
  signatureText: signatureTextField(
    'Additional signature text',
    MAX_SIGNATURE_TEXT_LENGTH,
  ),
});

function normaliseSignatureValue(value: string): string | null {
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === 'string' ? value : '';
}

function readPassword(
  raw: string,
  label: string,
  mode: EmailAccountFormMode,
): { password?: string; error?: string } {
  // The edit form starts with empty password inputs on purpose: empty means
  // "keep the stored credential", never "erase it".
  if (mode === 'edit' && raw.trim() === '') {
    return {};
  }

  if (raw === '') {
    return { error: `${label} password is required.` };
  }

  if (raw.length > MAX_PASSWORD_LENGTH) {
    return {
      error: `${label} password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    };
  }

  return { password: raw };
}

/**
 * Reads the whole form exactly once, on the client before submission and again
 * in the server action. Passwords are validated as typed and are never trimmed.
 */
export function readEmailAccountForm(
  formData: FormData,
  mode: EmailAccountFormMode,
): EmailAccountFormResult {
  const parsed = emailAccountFieldsSchema.safeParse({
    name: readString(formData, 'name'),
    senderName: readString(formData, 'senderName'),
    emailAddress: readString(formData, 'emailAddress'),
    smtpHost: readString(formData, 'smtpHost'),
    smtpPort: readString(formData, 'smtpPort'),
    smtpSecurity: readString(formData, 'smtpSecurity'),
    smtpUsername: readString(formData, 'smtpUsername'),
    imapHost: readString(formData, 'imapHost'),
    imapPort: readString(formData, 'imapPort'),
    imapSecurity: readString(formData, 'imapSecurity'),
    imapUsername: readString(formData, 'imapUsername'),
  });
  const fieldErrors: Record<string, string> = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.');

      if (field !== '' && fieldErrors[field] === undefined) {
        fieldErrors[field] = issue.message;
      }
    }
  }

  const parsedSignature = signatureFieldsSchema.safeParse({
    signatureName: readString(formData, 'signatureName'),
    signatureCompany: readString(formData, 'signatureCompany'),
    signaturePhone: readString(formData, 'signaturePhone'),
    signatureWebsite: readString(formData, 'signatureWebsite'),
    signatureWhatsapp: readString(formData, 'signatureWhatsapp'),
    signatureText: readString(formData, 'signatureText'),
  });

  if (!parsedSignature.success) {
    for (const issue of parsedSignature.error.issues) {
      const field = issue.path.join('.');

      if (field !== '' && fieldErrors[field] === undefined) {
        fieldErrors[field] = issue.message;
      }
    }
  }

  const smtpPassword = readPassword(
    readString(formData, 'smtpPassword'),
    'SMTP',
    mode,
  );
  const imapPassword = readPassword(
    readString(formData, 'imapPassword'),
    'IMAP',
    mode,
  );

  if (smtpPassword.error !== undefined) {
    fieldErrors.smtpPassword = smtpPassword.error;
  }

  if (imapPassword.error !== undefined) {
    fieldErrors.imapPassword = imapPassword.error;
  }

  if (
    !parsed.success ||
    !parsedSignature.success ||
    Object.keys(fieldErrors).length > 0
  ) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    input: {
      ...parsed.data,
      enabled: ['on', 'true', '1'].includes(readString(formData, 'enabled')),
      smtpPassword: smtpPassword.password,
      imapPassword: imapPassword.password,
      signatureName: normaliseSignatureValue(
        parsedSignature.data.signatureName,
      ),
      signatureCompany: normaliseSignatureValue(
        parsedSignature.data.signatureCompany,
      ),
      signaturePhone: normaliseSignatureValue(
        parsedSignature.data.signaturePhone,
      ),
      signatureWebsite: normaliseSignatureValue(
        parsedSignature.data.signatureWebsite,
      ),
      signatureWhatsapp: normaliseSignatureValue(
        parsedSignature.data.signatureWhatsapp,
      ),
      signatureText: normaliseSignatureValue(
        parsedSignature.data.signatureText,
      ),
    },
  };
}
