import { z } from 'zod';

/**
 * Wire contract of `GET/POST /email-accounts` and `GET/PATCH /email-accounts/:id`.
 *
 * The API never returns a credential: only `smtpPasswordConfigured` and
 * `imapPasswordConfigured` say whether one is stored. Unknown response fields
 * are dropped by zod, so no extra value can reach a component.
 */

export const emailSecurityModeSchema = z.enum(['TLS', 'STARTTLS']);

export type EmailSecurityMode = z.infer<typeof emailSecurityModeSchema>;

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
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EmailAccount = z.infer<typeof emailAccountSchema>;

export const emailAccountListSchema = z.array(emailAccountSchema);

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

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    input: {
      ...parsed.data,
      enabled: ['on', 'true', '1'].includes(readString(formData, 'enabled')),
      smtpPassword: smtpPassword.password,
      imapPassword: imapPassword.password,
    },
  };
}
