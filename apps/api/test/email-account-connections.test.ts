import { randomBytes } from 'node:crypto';
import type { Socket } from 'node:net';

import { plainToInstance } from 'class-transformer';
import type { SMTPTransportOptions } from 'nodemailer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ConnectionTimeoutError,
  classifyConnectionFailure,
  withConnectionTimeout,
} from '../src/modules/email-accounts/email-connection-errors';
import {
  EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV,
  decryptCredential,
  encryptCredential,
  parseEncryptionKey,
} from '../src/modules/email-accounts/credential-encryption';
import { UpdateEmailAccountDto } from '../src/modules/email-accounts/dto/update-email-account.dto';
import {
  toEmailAccountResponse,
  type EmailAccountResponse,
  type EmailAccountRow,
} from '../src/modules/email-accounts/email-accounts.mapper';
import { EmailAccountsService } from '../src/modules/email-accounts/email-accounts.service';
import {
  CONNECTION_VERIFICATION_TIMEOUTS,
  type ConnectionVerificationTarget,
  type ConnectionVerificationTimeouts,
} from '../src/modules/email-accounts/email-connection.constants';
import {
  EmailConnectionVerificationService,
  type ConnectionVerificationResult,
} from '../src/modules/email-accounts/email-connection-verification.service';
import type { ImapConnectionVerifier } from '../src/modules/email-accounts/imap-connection-verifier';
import {
  ImapCredentialVerificationError,
  ImapFlowConnectionVerifier,
} from '../src/modules/email-accounts/imap-connection-verifier';
import {
  MailDestinationError,
  SystemMailDestinationResolver,
  normalizeMailHostname,
  type ResolvedMailDestination,
} from '../src/modules/email-accounts/mail-destination';
import type { SmtpConnectionVerifier } from '../src/modules/email-accounts/smtp-connection-verifier';
import { NodemailerSmtpConnectionVerifier } from '../src/modules/email-accounts/smtp-connection-verifier';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Synthetic data only. No test contacts a DNS server, a mail server or a
 * database: every destination resolver and protocol adapter is a fake.
 */
const KEY_BASE64 = randomBytes(32).toString('base64');
const KEY = parseEncryptionKey(KEY_BASE64);
const PREVIOUS_KEY = process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];

const PUBLIC_ADDRESS = '93.184.216.34';
const PUBLIC_DESTINATION: ResolvedMailDestination = {
  host: 'smtp.example.test',
  address: PUBLIC_ADDRESS,
  family: 4,
};

const FAST_TIMEOUTS: ConnectionVerificationTimeouts = {
  connectionMs: 10,
  greetingMs: 10,
  socketMs: 10,
  overallMs: 25,
};

function accountRow(
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
    createdAt: new Date('2026-11-26T08:00:00.000Z'),
    updatedAt: new Date('2026-11-26T08:00:00.000Z'),
    ...overrides,
  };
}

type UpdateData = Record<string, unknown>;

type Store = {
  prisma: PrismaService;
  rows: Map<string, EmailAccountRow>;
  updates: UpdateData[];
};

/** Minimal in-memory Prisma delegate; never touches a database. */
function createStore(initial: readonly EmailAccountRow[] = []): Store {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
  const updates: UpdateData[] = [];

  const emailAccount = {
    findMany: async () => [...rows.values()],
    findUnique: async ({ where }: { where: { id: string } }) =>
      rows.get(where.id) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: UpdateData;
    }) => {
      const existing = rows.get(where.id);

      if (existing === undefined) {
        throw new Error(`No email account ${where.id}`);
      }

      updates.push(data);
      const updated: EmailAccountRow = {
        ...existing,
        ...(data as Partial<EmailAccountRow>),
        updatedAt: new Date(),
      };

      rows.set(where.id, updated);

      return updated;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: UpdateData;
    }) => {
      const id = where.id;
      const existing = typeof id === 'string' ? rows.get(id) : undefined;

      if (existing === undefined) {
        return { count: 0 };
      }

      const record = existing as unknown as Record<string, unknown>;

      for (const [key, value] of Object.entries(where)) {
        if (key === 'id') {
          continue;
        }

        if (record[key] !== value) {
          return { count: 0 };
        }
      }

      updates.push(data);
      rows.set(existing.id, {
        ...existing,
        ...(data as Partial<EmailAccountRow>),
        updatedAt: new Date(),
      });

      return { count: 1 };
    },
  };

  return {
    prisma: { emailAccount } as unknown as PrismaService,
    rows,
    updates,
  };
}

function fixedResolver(
  resolve: (
    host: string,
    timeoutMs: number,
  ) => Promise<ResolvedMailDestination> = async (host) => ({
    ...PUBLIC_DESTINATION,
    host,
  }),
): {
  resolver: { resolve: typeof resolve };
  calls: { host: string; timeoutMs: number }[];
} {
  const calls: { host: string; timeoutMs: number }[] = [];

  return {
    resolver: {
      resolve: (host: string, timeoutMs: number) => {
        calls.push({ host, timeoutMs });

        return resolve(host, timeoutMs);
      },
    },
    calls,
  };
}

function verificationService(
  store: Store,
  overrides: {
    resolver?: {
      resolve: (
        host: string,
        timeoutMs: number,
      ) => Promise<ResolvedMailDestination>;
    };
    smtpVerifier?: SmtpConnectionVerifier;
    imapVerifier?: ImapConnectionVerifier;
  } = {},
): EmailConnectionVerificationService {
  return new EmailConnectionVerificationService(
    store.prisma,
    overrides.resolver ?? fixedResolver().resolver,
    overrides.smtpVerifier ?? { verify: async () => undefined },
    overrides.imapVerifier ?? { verify: async () => undefined },
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function target(
  overrides: Partial<ConnectionVerificationTarget> = {},
): ConnectionVerificationTarget {
  return {
    protocol: 'SMTP',
    host: 'smtp.example.test',
    address: PUBLIC_ADDRESS,
    port: 587,
    security: 'STARTTLS',
    username: 'smtp-user',
    password: 'synthetic-smtp-secret',
    ...overrides,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function rejectionOf(run: Promise<unknown>): Promise<unknown> {
  try {
    await run;
  } catch (error) {
    return error;
  }

  throw new Error('Expected the call to reject');
}

async function destinationFailure(
  host: string,
  resolver: SystemMailDestinationResolver,
  timeoutMs = 100,
): Promise<MailDestinationError> {
  const failure = await rejectionOf(resolver.resolve(host, timeoutMs));

  if (!(failure instanceof MailDestinationError)) {
    throw new Error(`Expected a MailDestinationError for ${host}`);
  }

  return failure;
}

function storedRow(store: Store, id = 'account-1'): EmailAccountRow {
  const row = store.rows.get(id);

  if (row === undefined) {
    throw new Error(`Missing stored row ${id}`);
  }

  return row;
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

describe('verification metadata in the safe response mapping', () => {
  it('maps the independent states, timestamps and failure codes', () => {
    const row = accountRow({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T09:15:00.000Z'),
      imapVerificationStatus: 'FAILED',
      imapLastCheckedAt: new Date('2026-11-26T09:16:00.000Z'),
      imapVerificationFailureCode: 'AUTHENTICATION_FAILED',
    });
    const response = toEmailAccountResponse(row);

    expect(response.smtpVerificationStatus).toBe('VERIFIED');
    expect(response.smtpLastCheckedAt).toBe('2026-11-26T09:15:00.000Z');
    expect(response.smtpVerificationFailureCode).toBeNull();
    expect(response.imapVerificationStatus).toBe('FAILED');
    expect(response.imapLastCheckedAt).toBe('2026-11-26T09:16:00.000Z');
    expect(response.imapVerificationFailureCode).toBe('AUTHENTICATION_FAILED');

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain(row.smtpPasswordEncrypted);
    expect(serialized).not.toContain(row.imapPasswordEncrypted);
    expect(serialized).not.toContain('synthetic-smtp-secret');
    expect(serialized).not.toContain('synthetic-imap-secret');
  });

  it('maps an untested account with null timestamps', () => {
    const response = toEmailAccountResponse(accountRow());

    expect(response.smtpVerificationStatus).toBe('NOT_TESTED');
    expect(response.smtpLastCheckedAt).toBeNull();
    expect(response.smtpVerificationFailureCode).toBeNull();
    expect(response.imapVerificationStatus).toBe('NOT_TESTED');
    expect(response.imapLastCheckedAt).toBeNull();
    expect(response.imapVerificationFailureCode).toBeNull();
  });
});

describe('configuration-change invalidation', () => {
  const verifiedRow = (): EmailAccountRow =>
    accountRow({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T09:00:00.000Z'),
      smtpVerificationFailureCode: null,
      imapVerificationStatus: 'FAILED',
      imapLastCheckedAt: new Date('2026-11-26T09:05:00.000Z'),
      imapVerificationFailureCode: 'TLS_FAILURE',
    });

  async function apply(
    overrides: Record<string, unknown>,
  ): Promise<{ store: Store; updated: EmailAccountResponse }> {
    const store = createStore([verifiedRow()]);
    const service = new EmailAccountsService(store.prisma);
    const updated = await service.update(
      'account-1',
      plainToInstance(UpdateEmailAccountDto, overrides),
    );

    return { store, updated };
  }

  it('preserves both results when unrelated metadata changes', async () => {
    const { updated } = await apply({
      name: 'Renamed account',
      senderName: 'Renamed Sender',
      emailAddress: 'other@example.test',
      enabled: false,
    });

    expect(updated.smtpVerificationStatus).toBe('VERIFIED');
    expect(updated.smtpLastCheckedAt).toBe('2026-11-26T09:00:00.000Z');
    expect(updated.imapVerificationStatus).toBe('FAILED');
    expect(updated.imapLastCheckedAt).toBe('2026-11-26T09:05:00.000Z');
    expect(updated.imapVerificationFailureCode).toBe('TLS_FAILURE');
  });

  it('resets only SMTP when its host changes', async () => {
    const { updated } = await apply({ smtpHost: 'smtp.changed.test' });

    expect(updated.smtpVerificationStatus).toBe('NOT_TESTED');
    expect(updated.smtpLastCheckedAt).toBeNull();
    expect(updated.smtpVerificationFailureCode).toBeNull();
    expect(updated.imapVerificationStatus).toBe('FAILED');
    expect(updated.imapLastCheckedAt).toBe('2026-11-26T09:05:00.000Z');
    expect(updated.imapVerificationFailureCode).toBe('TLS_FAILURE');
  });

  it('resets only SMTP when its port, security or username changes', async () => {
    for (const change of [
      { smtpPort: 465 },
      { smtpSecurity: 'TLS' },
      { smtpUsername: 'other-smtp-user' },
    ]) {
      const { updated } = await apply(change);

      expect(updated.smtpVerificationStatus).toBe('NOT_TESTED');
      expect(updated.smtpLastCheckedAt).toBeNull();
      expect(updated.imapVerificationStatus).toBe('FAILED');
    }
  });

  it('does not reset a result when the submitted values are unchanged', async () => {
    const { updated } = await apply({
      smtpHost: 'smtp.example.test',
      smtpPort: 587,
      smtpSecurity: 'STARTTLS',
      smtpUsername: 'smtp-user',
    });

    expect(updated.smtpVerificationStatus).toBe('VERIFIED');
    expect(updated.smtpLastCheckedAt).toBe('2026-11-26T09:00:00.000Z');
    expect(updated.imapVerificationStatus).toBe('FAILED');
  });

  it('resets only SMTP when its password is replaced', async () => {
    const { store, updated } = await apply({ smtpPassword: 'rotated-secret' });

    expect(updated.smtpVerificationStatus).toBe('NOT_TESTED');
    expect(updated.smtpLastCheckedAt).toBeNull();
    expect(updated.imapVerificationStatus).toBe('FAILED');
    expect(
      decryptCredential(
        String(storedRow(store).smtpPasswordEncrypted),
        KEY,
      ),
    ).toBe('rotated-secret');
  });

  it('keeps both results and the credential for an empty password field', async () => {
    const store = createStore([verifiedRow()]);
    const service = new EmailAccountsService(store.prisma);
    const before = storedRow(store);
    const updated = await service.update(
      'account-1',
      plainToInstance(UpdateEmailAccountDto, {
        smtpPassword: '',
        imapPassword: '   ',
      }),
    );

    expect(updated.smtpVerificationStatus).toBe('VERIFIED');
    expect(updated.imapVerificationStatus).toBe('FAILED');
    expect(storedRow(store).smtpPasswordEncrypted).toBe(
      before.smtpPasswordEncrypted,
    );
    expect(storedRow(store).imapPasswordEncrypted).toBe(
      before.imapPasswordEncrypted,
    );
    expect(store.updates).toHaveLength(0);
  });

  it('resets only IMAP when its configuration changes', async () => {
    for (const change of [
      { imapHost: 'imap.changed.test' },
      { imapPort: 143 },
      { imapSecurity: 'STARTTLS' },
      { imapUsername: 'other-imap-user' },
      { imapPassword: 'rotated-imap-secret' },
    ]) {
      const { updated } = await apply(change);

      expect(updated.imapVerificationStatus).toBe('NOT_TESTED');
      expect(updated.imapLastCheckedAt).toBeNull();
      expect(updated.imapVerificationFailureCode).toBeNull();
      expect(updated.smtpVerificationStatus).toBe('VERIFIED');
      expect(updated.smtpLastCheckedAt).toBe('2026-11-26T09:00:00.000Z');
    }
  });
});

describe('mail destination guard', () => {
  it('normalizes a hostname and returns the resolved public address', async () => {
    const resolver = new SystemMailDestinationResolver(
      async () => [{ address: PUBLIC_ADDRESS, family: 4 }],
    );
    const destination = await resolver.resolve(' SMTP.Example.Test ', 100);

    expect(destination).toEqual({
      host: 'smtp.example.test',
      address: PUBLIC_ADDRESS,
      family: 4,
    });
  });

  it('prefers a public IPv4 address when the host has both families', async () => {
    const resolver = new SystemMailDestinationResolver(async () => [
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      { address: PUBLIC_ADDRESS, family: 4 },
    ]);
    const destination = await resolver.resolve('smtp.example.test', 100);

    expect(destination.address).toBe(PUBLIC_ADDRESS);
    expect(destination.family).toBe(4);
  });

  it('accepts a public IPv4 or IPv6 literal without a lookup', async () => {
    let lookups = 0;
    const resolver = new SystemMailDestinationResolver(async () => {
      lookups += 1;

      return [];
    });

    await expect(resolver.resolve('9.9.9.9', 100)).resolves.toEqual({
      host: '9.9.9.9',
      address: '9.9.9.9',
      family: 4,
    });
    await expect(
      resolver.resolve('2606:4700:4700::1111', 100),
    ).resolves.toMatchObject({ address: '2606:4700:4700::1111', family: 6 });
    expect(lookups).toBe(0);
  });

  it('rejects localhost and non-public IPv4 destinations', async () => {
    const resolver = new SystemMailDestinationResolver(async () => []);

    for (const host of [
      'localhost',
      'mail.localhost',
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '172.16.5.4',
      '192.0.2.10',
      '192.168.0.1',
      '198.18.0.1',
      '198.51.100.7',
      '203.0.113.9',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      const failure = await destinationFailure(host, resolver);

      expect(failure.failureCode).toBe('UNSAFE_DESTINATION');
    }
  });

  it('rejects non-public IPv6 destinations and their IPv4 equivalents', async () => {
    const resolver = new SystemMailDestinationResolver(async () => []);

    for (const host of [
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '64:ff9b::7f00:1',
      '100::1',
      '2001::1',
      '2001:2::1',
      '2001:db8::1',
      '2002:7f00:1::',
      '3fff::1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
    ]) {
      const failure = await destinationFailure(host, resolver);

      expect(failure.failureCode).toBe('UNSAFE_DESTINATION');
    }
  });

  it('rejects a host whose resolution contains any non-public address', async () => {
    const resolver = new SystemMailDestinationResolver(async () => [
      { address: PUBLIC_ADDRESS, family: 4 },
      { address: '10.0.0.7', family: 4 },
    ]);
    const failure = await destinationFailure('smtp.example.test', resolver);

    expect(failure.failureCode).toBe('UNSAFE_DESTINATION');
  });

  it('rejects malformed destination hostnames', async () => {
    const resolver = new SystemMailDestinationResolver(async () => []);

    for (const host of [
      '',
      '   ',
      'https://smtp.example.test',
      'smtp.example.test/path',
      'smtp example.test',
      'smtp.example.test.',
      '[::1]',
      'user@smtp.example.test',
      '-smtp.example.test',
      'smtp-.example.test',
      `${'a'.repeat(250)}.test`,
    ]) {
      const failure = await destinationFailure(host, resolver);

      expect(failure.failureCode).toBe('INVALID_CONFIGURATION');
    }
  });

  it('maps resolver failures to safe DNS and timeout codes', async () => {
    const dnsFailure = new SystemMailDestinationResolver(async () => {
      throw Object.assign(new Error('queryA ENOTFOUND'), { code: 'ENOTFOUND' });
    });
    const empty = new SystemMailDestinationResolver(async () => []);
    const hanging = new SystemMailDestinationResolver(
      () => new Promise(() => undefined),
    );

    expect(
      (await destinationFailure('smtp.example.test', dnsFailure)).failureCode,
    ).toBe('DNS_FAILURE');
    expect(
      (await destinationFailure('smtp.example.test', empty)).failureCode,
    ).toBe('DNS_FAILURE');
    expect(
      (await destinationFailure('smtp.example.test', hanging, 10)).failureCode,
    ).toBe('CONNECTION_TIMEOUT');
  });

  it('never accepts a host it cannot normalize', () => {
    expect(normalizeMailHostname('SMTP.Example.Test')).toBe(
      'smtp.example.test',
    );
    expect(normalizeMailHostname('::1')).toBe('::1');
    expect(normalizeMailHostname('bad host')).toBeNull();
  });
});

describe('SMTP verification adapter', () => {
  it('uses implicit TLS with certificate and hostname validation', async () => {
    const captured: SMTPTransportOptions[] = [];
    let closed = 0;
    const adapter = new NodemailerSmtpConnectionVerifier(
      (options) => {
        captured.push(options);

        return {
          verify: async () => true,
          close: () => {
            closed += 1;
          },
        };
      },
      FAST_TIMEOUTS,
    );

    await adapter.verify(target({ security: 'TLS', port: 465 }));

    const options = captured[0];

    expect(options.host).toBe(PUBLIC_ADDRESS);
    expect(options.port).toBe(465);
    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBe(false);
    expect(options.servername).toBe('smtp.example.test');
    expect(options.tls?.rejectUnauthorized).toBe(true);
    expect(options.tls?.servername).toBe('smtp.example.test');
    expect(options.auth).toEqual({
      user: 'smtp-user',
      pass: 'synthetic-smtp-secret',
    });
    expect(options.forceAuth).toBe(true);
    expect(options.connectionTimeout).toBe(FAST_TIMEOUTS.connectionMs);
    expect(options.greetingTimeout).toBe(FAST_TIMEOUTS.greetingMs);
    expect(options.socketTimeout).toBe(FAST_TIMEOUTS.socketMs);
    expect(options.dnsTimeout).toBe(CONNECTION_VERIFICATION_TIMEOUTS.dnsLookupMs);
    expect(options.allowInternalNetworkInterfaces).toBe(false);
    expect(options.logger).toBe(false);
    expect(options.socket).toBeDefined();
    expect((options.socket as Socket).destroyed).toBe(true);
    expect(closed).toBe(1);
  });

  it('forces a STARTTLS upgrade before authentication', async () => {
    const captured: SMTPTransportOptions[] = [];
    const adapter = new NodemailerSmtpConnectionVerifier(
      (options) => {
        captured.push(options);

        return { verify: async () => true, close: () => undefined };
      },
      FAST_TIMEOUTS,
    );

    await adapter.verify(target({ security: 'STARTTLS', port: 587 }));

    expect(captured[0].secure).toBe(false);
    expect(captured[0].requireTLS).toBe(true);
    expect(captured[0].tls?.rejectUnauthorized).toBe(true);
    expect(captured[0].tls?.servername).toBe('smtp.example.test');
  });

  it('never sends a message, only verifies', async () => {
    let sendMailCalls = 0;
    const adapter = new NodemailerSmtpConnectionVerifier(
      () => {
        const transport = {
          verify: async () => true,
          close: () => undefined,
          sendMail: async () => {
            sendMailCalls += 1;

            return {};
          },
        };

        return transport;
      },
      FAST_TIMEOUTS,
    );

    await adapter.verify(target());

    expect(sendMailCalls).toBe(0);
  });

  it('propagates an authentication failure and cleans up', async () => {
    let closed = 0;
    let socket: Socket | undefined;
    const adapter = new NodemailerSmtpConnectionVerifier(
      (options) => {
        socket = options.socket as Socket;

        return {
          verify: async () => {
            throw Object.assign(new Error('Invalid login: 535'), {
              code: 'EAUTH',
            });
          },
          close: () => {
            closed += 1;
          },
        };
      },
      FAST_TIMEOUTS,
    );

    const failure = await rejectionOf(adapter.verify(target()));

    expect((failure as { code?: string }).code).toBe('EAUTH');
    expect(closed).toBe(1);
    expect(socket?.destroyed).toBe(true);
  });

  it('bounds a hanging verification by the overall timeout and destroys the socket', async () => {
    let socket: Socket | undefined;
    let closed = 0;
    const adapter = new NodemailerSmtpConnectionVerifier(
      (options) => {
        socket = options.socket as Socket;

        return {
          verify: () => new Promise(() => undefined),
          close: () => {
            closed += 1;
          },
        };
      },
      FAST_TIMEOUTS,
    );

    await expect(adapter.verify(target())).rejects.toBeInstanceOf(
      ConnectionTimeoutError,
    );
    expect(closed).toBe(1);
    expect(socket?.destroyed).toBe(true);
  });
});

describe('IMAP verification adapter', () => {
  it('uses implicit TLS with certificate and hostname validation', async () => {
    const captured: Record<string, unknown>[] = [];
    let closed = 0;
    const adapter = new ImapFlowConnectionVerifier(
      (options) => {
        captured.push(options as unknown as Record<string, unknown>);

        return {
          // An empty normal OK greeting is still a defined greeting; only
          // PREAUTH leaves the property undefined.
          greeting: '',
          connect: async () => undefined,
          logout: async () => undefined,
          close: () => {
            closed += 1;
          },
        };
      },
      FAST_TIMEOUTS,
    );

    await adapter.verify(
      target({ protocol: 'IMAP', security: 'TLS', port: 993 }),
    );

    const options = captured[0];

    expect(options.host).toBe(PUBLIC_ADDRESS);
    expect(options.port).toBe(993);
    expect(options.secure).toBe(true);
    expect(options.doSTARTTLS).toBeUndefined();
    expect(options.servername).toBe('smtp.example.test');
    expect(options.verifyOnly).toBe(true);
    expect(options.includeMailboxes).toBe(false);
    expect(options.logger).toBe(false);
    expect(options.logRaw).toBe(false);
    expect(options.emitLogs).toBe(false);
    expect(options.auth).toEqual({
      user: 'smtp-user',
      pass: 'synthetic-smtp-secret',
    });
    expect((options.tls as { rejectUnauthorized?: boolean }).rejectUnauthorized).toBe(true);
    expect((options.tls as { servername?: string }).servername).toBe('smtp.example.test');
    expect(options.connectionTimeout).toBe(FAST_TIMEOUTS.connectionMs);
    expect(options.greetingTimeout).toBe(FAST_TIMEOUTS.greetingMs);
    expect(options.socketTimeout).toBe(FAST_TIMEOUTS.socketMs);
    expect(closed).toBe(1);
  });

  it('requires the TLS upgrade for STARTTLS', async () => {
    const captured: Record<string, unknown>[] = [];
    const adapter = new ImapFlowConnectionVerifier(
      (options) => {
        captured.push(options as unknown as Record<string, unknown>);

        return {
          greeting: 'IMAP4rev1 ready',
          connect: async () => undefined,
          logout: async () => undefined,
          close: () => undefined,
        };
      },
      FAST_TIMEOUTS,
    );

    await adapter.verify(
      target({ protocol: 'IMAP', security: 'STARTTLS', port: 143 }),
    );

    expect(captured[0].secure).toBe(false);
    expect(captured[0].doSTARTTLS).toBe(true);
    expect(captured[0].verifyOnly).toBe(true);
  });

  it('accepts a normal OK greeting as credential authentication', async () => {
    let closed = 0;
    const adapter = new ImapFlowConnectionVerifier(
      () => ({
        greeting: 'IMAP4rev1 ready',
        connect: async () => undefined,
        logout: async () => undefined,
        close: () => {
          closed += 1;
        },
      }),
      FAST_TIMEOUTS,
    );

    await expect(
      adapter.verify(target({ protocol: 'IMAP' })),
    ).resolves.toBeUndefined();
    expect(closed).toBe(1);
  });

  it('rejects a PREAUTH greeting that bypassed credential authentication and closes', async () => {
    let closed = 0;
    const adapter = new ImapFlowConnectionVerifier(
      () => ({
        // ImapFlow 2.12.2 leaves `greeting` undefined only for PREAUTH.
        greeting: undefined,
        connect: async () => undefined,
        logout: async () => undefined,
        close: () => {
          closed += 1;
        },
      }),
      FAST_TIMEOUTS,
    );

    const failure = await rejectionOf(
      adapter.verify(target({ protocol: 'IMAP' })),
    );

    expect(failure).toBeInstanceOf(ImapCredentialVerificationError);
    expect(
      (failure as { authenticationFailed?: boolean }).authenticationFailed,
    ).toBe(true);
    expect(closed).toBe(1);
  });

  it('never opens, lists, fetches or changes a mailbox', async () => {
    const forbidden = (method: string) => async () => {
      throw new Error(`IMAP ${method} must not be called`);
    };
    const adapter = new ImapFlowConnectionVerifier(
      () => {
        const client = {
          greeting: 'IMAP4rev1 ready',
          connect: async () => undefined,
          logout: async () => undefined,
          close: () => undefined,
          mailboxOpen: forbidden('mailboxOpen'),
          list: forbidden('list'),
          fetch: forbidden('fetch'),
          search: forbidden('search'),
          messageFlagAdd: forbidden('messageFlagAdd'),
          messageMove: forbidden('messageMove'),
          messageDelete: forbidden('messageDelete'),
        };

        return client;
      },
      FAST_TIMEOUTS,
    );

    await adapter.verify(target({ protocol: 'IMAP' }));
    expect(true).toBe(true);
  });

  it('propagates an authentication failure and closes the connection', async () => {
    let closed = 0;
    const adapter = new ImapFlowConnectionVerifier(
      () => ({
        greeting: 'IMAP4rev1 ready',
        connect: async () => {
          throw Object.assign(new Error('Authentication failed'), {
            authenticationFailed: true,
          });
        },
        logout: async () => undefined,
        close: () => {
          closed += 1;
        },
      }),
      FAST_TIMEOUTS,
    );

    const failure = await rejectionOf(
      adapter.verify(target({ protocol: 'IMAP' })),
    );

    expect((failure as { authenticationFailed?: boolean }).authenticationFailed).toBe(true);
    expect(closed).toBe(1);
  });

  it('bounds a hanging connection by the overall timeout and closes it', async () => {
    let closed = 0;
    const adapter = new ImapFlowConnectionVerifier(
      () => ({
        greeting: 'IMAP4rev1 ready',
        connect: () => new Promise(() => undefined),
        logout: async () => undefined,
        close: () => {
          closed += 1;
        },
      }),
      FAST_TIMEOUTS,
    );

    await expect(
      adapter.verify(target({ protocol: 'IMAP' })),
    ).rejects.toBeInstanceOf(ConnectionTimeoutError);
    expect(closed).toBe(1);
  });
});

describe('safe connection-failure classification', () => {
  it('maps library and Node error codes to safe codes', () => {
    expect(classifyConnectionFailure({ code: 'EAUTH' })).toBe(
      'AUTHENTICATION_FAILED',
    );
    expect(classifyConnectionFailure({ authenticationFailed: true })).toBe(
      'AUTHENTICATION_FAILED',
    );
    expect(classifyConnectionFailure({ responseCode: 535 })).toBe(
      'AUTHENTICATION_FAILED',
    );
    expect(classifyConnectionFailure({ code: 'ETIMEDOUT' })).toBe(
      'CONNECTION_TIMEOUT',
    );
    expect(classifyConnectionFailure({ timeoutType: 'GREETING_TIMEOUT' })).toBe(
      'CONNECTION_TIMEOUT',
    );
    expect(classifyConnectionFailure(new ConnectionTimeoutError())).toBe(
      'CONNECTION_TIMEOUT',
    );
    expect(classifyConnectionFailure({ code: 'ENOTFOUND' })).toBe(
      'DNS_FAILURE',
    );
    expect(classifyConnectionFailure({ code: 'EDNS' })).toBe('DNS_FAILURE');
    expect(classifyConnectionFailure({ code: 'ECONNREFUSED' })).toBe(
      'CONNECTION_REFUSED',
    );
    expect(classifyConnectionFailure({ tlsFailed: true })).toBe(
      'TLS_FAILURE',
    );
    expect(classifyConnectionFailure({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })).toBe(
      'TLS_FAILURE',
    );
    expect(
      classifyConnectionFailure({
        code: 'ESOCKET',
        originalCode: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      }),
    ).toBe('TLS_FAILURE');
    expect(classifyConnectionFailure({ code: 'ESOCKET' })).toBe(
      'CONNECTION_FAILED',
    );
    expect(classifyConnectionFailure(new Error('535 invalid login'))).toBe(
      'CONNECTION_FAILED',
    );
    expect(classifyConnectionFailure(undefined)).toBe('CONNECTION_FAILED');
  });

  it('classifies the extended certificate and CRL verification codes as TLS failures', () => {
    const cases = [
      'UNABLE_TO_GET_CRL',
      'UNABLE_TO_GET_CRL_ISSUER',
      'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
      'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
      'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
      'CRL_SIGNATURE_FAILURE',
      'CRL_NOT_YET_VALID',
      'CRL_HAS_EXPIRED',
      'ERROR_IN_CERT_NOT_BEFORE_FIELD',
      'ERROR_IN_CERT_NOT_AFTER_FIELD',
      'ERROR_IN_CRL_LAST_UPDATE_FIELD',
      'ERROR_IN_CRL_NEXT_UPDATE_FIELD',
      'INVALID_CA',
      'PATH_LENGTH_EXCEEDED',
      'INVALID_PURPOSE',
      'HOSTNAME_MISMATCH',
      'SUBJECT_ISSUER_MISMATCH',
      'AKID_SKID_MISMATCH',
      'AKID_ISSUER_SERIAL_MISMATCH',
      'KEYUSAGE_NO_CERTSIGN',
      'UNHANDLED_CRITICAL_EXTENSION',
      'UNHANDLED_CRITICAL_CRL_EXTENSION',
      'INVALID_NON_CA',
      'PROXY_PATH_LENGTH_EXCEEDED',
      'PROXY_CERTIFICATES_NOT_ALLOWED',
      'DIFFERENT_CRL_SCOPE',
      'CRL_PATH_VALIDATION_ERROR',
    ];

    for (const code of cases) {
      expect(classifyConnectionFailure({ code })).toBe('TLS_FAILURE');
    }

    expect(
      classifyConnectionFailure({
        code: 'ESOCKET',
        originalCode: 'UNABLE_TO_GET_CRL',
      }),
    ).toBe('TLS_FAILURE');
  });

  it('does not classify non-TLS network or authentication errors as TLS failures', () => {
    const cases: readonly [unknown, string][] = [
      [{ code: 'EAUTH' }, 'AUTHENTICATION_FAILED'],
      [{ authenticationFailed: true }, 'AUTHENTICATION_FAILED'],
      [{ code: 'ETIMEDOUT' }, 'CONNECTION_TIMEOUT'],
      [{ timeoutType: 'CONNECT_TIMEOUT' }, 'CONNECTION_TIMEOUT'],
      [{ code: 'ENOTFOUND' }, 'DNS_FAILURE'],
      [{ code: 'EAI_AGAIN' }, 'DNS_FAILURE'],
      [{ code: 'ECONNREFUSED' }, 'CONNECTION_REFUSED'],
      [{ code: 'ESOCKET' }, 'CONNECTION_FAILED'],
      [{ code: 'ECONNRESET' }, 'CONNECTION_FAILED'],
      [{ code: 'EPIPE' }, 'CONNECTION_FAILED'],
      [{ code: 'ERR_ACCESS_DENIED' }, 'CONNECTION_FAILED'],
    ];

    for (const [error, expected] of cases) {
      expect(classifyConnectionFailure(error)).toBe(expected);
    }
  });

  it('settles a hanging operation with a typed timeout', async () => {
    await expect(
      withConnectionTimeout(new Promise(() => undefined), 10),
    ).rejects.toBeInstanceOf(ConnectionTimeoutError);
    await expect(withConnectionTimeout(Promise.resolve('ok'), 50)).resolves.toBe(
      'ok',
    );
  });
});

describe('saved-configuration verification service', () => {
  it('verifies SMTP and persists only the SMTP result', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const calls: ConnectionVerificationTarget[] = [];
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async (value) => {
          calls.push(value);
        },
      },
    });

    const result = await service.verify(row.id, 'SMTP');
    const stored = storedRow(store);

    expect(result.result).toBe('VERIFIED');
    expect(result.protocol).toBe('SMTP');
    expect(result.failureCode).toBeNull();
    expect(result.lastCheckedAt).not.toBeNull();
    expect(result.account.smtpVerificationStatus).toBe('VERIFIED');
    expect(stored.smtpVerificationStatus).toBe('VERIFIED');
    expect(stored.smtpLastCheckedAt).toBeInstanceOf(Date);
    expect(stored.smtpVerificationFailureCode).toBeNull();
    expect(stored.imapVerificationStatus).toBe('NOT_TESTED');
    expect(stored.imapLastCheckedAt).toBeNull();
    expect(stored.imapVerificationFailureCode).toBeNull();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      protocol: 'SMTP',
      host: row.smtpHost,
      address: PUBLIC_ADDRESS,
      port: row.smtpPort,
      security: row.smtpSecurity,
      username: row.smtpUsername,
      password: 'synthetic-smtp-secret',
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('synthetic-smtp-secret');
    expect(serialized).not.toContain(row.smtpPasswordEncrypted);
    expect(serialized).not.toContain(row.imapPasswordEncrypted);
  });

  it('verifies IMAP independently of the SMTP result', async () => {
    const row = accountRow({
      smtpVerificationStatus: 'FAILED',
      smtpLastCheckedAt: new Date('2026-11-26T08:30:00.000Z'),
      smtpVerificationFailureCode: 'AUTHENTICATION_FAILED',
    });
    const store = createStore([row]);
    const service = verificationService(store);

    const result = await service.verify(row.id, 'IMAP');
    const stored = storedRow(store);

    expect(result.result).toBe('VERIFIED');
    expect(stored.imapVerificationStatus).toBe('VERIFIED');
    expect(stored.imapLastCheckedAt).toBeInstanceOf(Date);
    expect(stored.imapVerificationFailureCode).toBeNull();
    expect(stored.smtpVerificationStatus).toBe('FAILED');
    expect(stored.smtpLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:30:00.000Z',
    );
    expect(stored.smtpVerificationFailureCode).toBe('AUTHENTICATION_FAILED');
  });

  it('persists an SMTP failure without touching the IMAP result', async () => {
    const row = accountRow({
      imapVerificationStatus: 'VERIFIED',
      imapLastCheckedAt: new Date('2026-11-26T08:40:00.000Z'),
    });
    const store = createStore([row]);
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async () => {
          throw Object.assign(new Error('Invalid login: 535'), {
            code: 'EAUTH',
            response: '535 5.7.8 Authentication credentials invalid',
          });
        },
      },
    });

    const result = await service.verify(row.id, 'SMTP');
    const stored = storedRow(store);

    expect(result.result).toBe('FAILED');
    expect(result.failureCode).toBe('AUTHENTICATION_FAILED');
    expect(result.lastCheckedAt).not.toBeNull();
    expect(stored.smtpVerificationStatus).toBe('FAILED');
    expect(stored.smtpVerificationFailureCode).toBe('AUTHENTICATION_FAILED');
    expect(stored.imapVerificationStatus).toBe('VERIFIED');
    expect(stored.imapLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:40:00.000Z',
    );
    expect(JSON.stringify(result)).not.toContain('535 5.7.8');
  });

  it('maps every expected SMTP failure to a structured failed result', async () => {
    const cases: readonly [unknown, string][] = [
      [{ code: 'EAUTH' }, 'AUTHENTICATION_FAILED'],
      [{ timeoutType: 'CONNECT_TIMEOUT' }, 'CONNECTION_TIMEOUT'],
      [{ code: 'ECONNREFUSED' }, 'CONNECTION_REFUSED'],
      [{ code: 'ENOTFOUND' }, 'DNS_FAILURE'],
      [{ tlsFailed: true }, 'TLS_FAILURE'],
      [{ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }, 'TLS_FAILURE'],
      [{ code: 'EConnectionClosed' }, 'CONNECTION_FAILED'],
    ];

    for (const [thrown, expected] of cases) {
      const row = accountRow();
      const store = createStore([row]);
      const service = verificationService(store, {
        smtpVerifier: {
          verify: async () => {
            throw thrown;
          },
        },
      });
      const result = await service.verify(row.id, 'SMTP');

      expect(result.result).toBe('FAILED');
      expect(result.failureCode).toBe(expected);
      expect(storedRow(store).smtpVerificationStatus).toBe('FAILED');
      expect(storedRow(store).smtpVerificationFailureCode).toBe(expected);
    }
  });

  it('maps an IMAP authentication failure and preserves SMTP', async () => {
    const row = accountRow({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T08:20:00.000Z'),
    });
    const store = createStore([row]);
    const service = verificationService(store, {
      imapVerifier: {
        verify: async () => {
          throw Object.assign(new Error('Authentication failed'), {
            authenticationFailed: true,
          });
        },
      },
    });
    const result = await service.verify(row.id, 'IMAP');

    expect(result.result).toBe('FAILED');
    expect(result.failureCode).toBe('AUTHENTICATION_FAILED');
    expect(storedRow(store).imapVerificationStatus).toBe('FAILED');
    expect(storedRow(store).imapVerificationFailureCode).toBe(
      'AUTHENTICATION_FAILED',
    );
    expect(storedRow(store).smtpVerificationStatus).toBe('VERIFIED');
  });

  it('maps a PREAUTH credential bypass to the existing authentication failure result', async () => {
    const row = accountRow({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T08:20:00.000Z'),
    });
    const store = createStore([row]);
    const service = verificationService(store, {
      imapVerifier: {
        verify: async () => {
          throw new ImapCredentialVerificationError();
        },
      },
    });
    const result = await service.verify(row.id, 'IMAP');
    const stored = storedRow(store);

    expect(result.result).toBe('FAILED');
    expect(result.failureCode).toBe('AUTHENTICATION_FAILED');
    expect(result.lastCheckedAt).not.toBeNull();
    expect(stored.imapVerificationStatus).toBe('FAILED');
    expect(stored.imapVerificationFailureCode).toBe('AUTHENTICATION_FAILED');
    expect(stored.imapLastCheckedAt).toBeInstanceOf(Date);
    expect(stored.smtpVerificationStatus).toBe('VERIFIED');
    expect(stored.smtpLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:20:00.000Z',
    );
  });

  it('rejects a saved port outside the standard mail ports without dialing', async () => {
    for (const [protocol, port] of [
      ['SMTP', 25],
      ['SMTP', 2525],
      ['IMAP', 110],
      ['IMAP', 8080],
    ] as const) {
      const row =
        protocol === 'SMTP'
          ? accountRow({ smtpPort: port })
          : accountRow({ imapPort: port });
      const store = createStore([row]);
      const resolver = fixedResolver();
      const smtpVerifier = { verify: async () => undefined };
      const imapVerifier = { verify: async () => undefined };
      const service = verificationService(store, {
        resolver: resolver.resolver,
        smtpVerifier,
        imapVerifier,
      });
      const result = await service.verify(row.id, protocol);

      expect(result.result).toBe('FAILED');
      expect(result.failureCode).toBe('INVALID_CONFIGURATION');
      expect(resolver.calls).toHaveLength(0);
    }
  });

  it('reports an unsafe destination without decrypting or dialing', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const verifierCalls: ConnectionVerificationTarget[] = [];
    const service = verificationService(store, {
      resolver: {
        resolve: async () => {
          throw new MailDestinationError(
            'UNSAFE_DESTINATION',
            'The configured host resolves to a non-public address.',
          );
        },
      },
      smtpVerifier: {
        verify: async (value) => {
          verifierCalls.push(value);
        },
      },
    });
    const result = await service.verify(row.id, 'SMTP');

    expect(result.result).toBe('FAILED');
    expect(result.failureCode).toBe('UNSAFE_DESTINATION');
    expect(verifierCalls).toHaveLength(0);
    expect(storedRow(store).smtpVerificationStatus).toBe('FAILED');
    expect(storedRow(store).smtpVerificationFailureCode).toBe(
      'UNSAFE_DESTINATION',
    );
  });

  it('reports DNS and timeout failures from the destination resolver', async () => {
    for (const [failureCode, expected] of [
      ['DNS_FAILURE', 'DNS_FAILURE'],
      ['CONNECTION_TIMEOUT', 'CONNECTION_TIMEOUT'],
      ['INVALID_CONFIGURATION', 'INVALID_CONFIGURATION'],
    ] as const) {
      const row = accountRow();
      const store = createStore([row]);
      const service = verificationService(store, {
        resolver: {
          resolve: async () => {
            throw new MailDestinationError(failureCode, 'safe');
          },
        },
      });
      const result = await service.verify(row.id, 'IMAP');

      expect(result.result).toBe('FAILED');
      expect(result.failureCode).toBe(expected);
      expect(storedRow(store).imapVerificationStatus).toBe('FAILED');
    }
  });

  it('reports unavailable credentials as a structured failure without dialing', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const verifierCalls: ConnectionVerificationTarget[] = [];
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async (value) => {
          verifierCalls.push(value);
        },
      },
    });

    delete process.env[EMAIL_ACCOUNT_ENCRYPTION_KEY_ENV];

    const result = await service.verify(row.id, 'SMTP');

    expect(result.result).toBe('FAILED');
    expect(result.failureCode).toBe('CREDENTIAL_UNAVAILABLE');
    expect(verifierCalls).toHaveLength(0);
    expect(storedRow(store).smtpVerificationStatus).toBe('FAILED');
    expect(JSON.stringify(result)).not.toContain('synthetic-smtp-secret');
  });

  it('decrypts only the credential of the requested protocol', async () => {
    const row = accountRow({ imapPasswordEncrypted: 'v1.broken' });
    const store = createStore([row]);
    const imapCalls: ConnectionVerificationTarget[] = [];
    const service = verificationService(store, {
      imapVerifier: {
        verify: async (value) => {
          imapCalls.push(value);
        },
      },
    });

    const smtpResult = await service.verify(row.id, 'SMTP');

    expect(smtpResult.result).toBe('VERIFIED');

    const imapResult = await service.verify(row.id, 'IMAP');

    expect(imapResult.result).toBe('FAILED');
    expect(imapResult.failureCode).toBe('CREDENTIAL_UNAVAILABLE');
    expect(imapCalls).toHaveLength(0);
    expect(storedRow(store).imapVerificationStatus).toBe('FAILED');
    expect(storedRow(store).imapVerificationFailureCode).toBe(
      'CREDENTIAL_UNAVAILABLE',
    );
  });

  it('refuses to test a disabled account', async () => {
    const row = accountRow({ enabled: false });
    const store = createStore([row]);
    const calls: ConnectionVerificationTarget[] = [];
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async (value) => {
          calls.push(value);
        },
      },
    });
    const failure = await rejectionOf(service.verify(row.id, 'SMTP'));

    expect(messageOf(failure)).toContain('Disabled email accounts');
    expect(calls).toHaveLength(0);
    expect(storedRow(store).smtpVerificationStatus).toBe('NOT_TESTED');
    expect(store.updates).toHaveLength(0);
  });

  it('reports a missing account as not found', async () => {
    const store = createStore();
    const service = verificationService(store);

    await expect(service.verify('missing', 'SMTP')).rejects.toThrow(
      /not found/,
    );
  });

  it('prevents overlapping tests for the same protocol but not for the other', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const gate = deferred<void>();
    let entered = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let smtpCalls = 0;
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async () => {
          smtpCalls += 1;
          entered();
          await gate.promise;
        },
      },
    });

    const first = service.verify(row.id, 'SMTP');

    await started;

    const duplicate = await rejectionOf(service.verify(row.id, 'SMTP'));

    expect(messageOf(duplicate)).toContain('already running');
    expect(smtpCalls).toBe(1);

    const imap = await service.verify(row.id, 'IMAP');

    expect(imap.result).toBe('VERIFIED');

    gate.resolve();

    await expect(first).resolves.toMatchObject({ result: 'VERIFIED' });

    await expect(service.verify(row.id, 'SMTP')).resolves.toMatchObject({
      result: 'VERIFIED',
    });
    expect(smtpCalls).toBe(2);
  });

  it('rejects a stale result when the configuration changed while testing', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const gate = deferred<void>();
    let entered = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async () => {
          entered();
          await gate.promise;
        },
      },
    });

    const pending = service.verify(row.id, 'SMTP');

    await started;

    const current = storedRow(store);
    store.rows.set(current.id, {
      ...current,
      smtpHost: 'smtp.changed.test',
      smtpVerificationStatus: 'NOT_TESTED',
      smtpLastCheckedAt: null,
      smtpVerificationFailureCode: null,
    });

    gate.resolve();

    const result = await pending;

    expect(result.result).toBe('CONFIGURATION_CHANGED');
    expect(result.failureCode).toBeNull();
    expect(result.lastCheckedAt).toBeNull();
    expect(storedRow(store).smtpHost).toBe('smtp.changed.test');
    expect(storedRow(store).smtpVerificationStatus).toBe('NOT_TESTED');
    expect(storedRow(store).smtpLastCheckedAt).toBeNull();
  });

  it('rejects a stale result when only the credential changed', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const gate = deferred<void>();
    let entered = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async () => {
          entered();
          await gate.promise;
        },
      },
    });

    const pending = service.verify(row.id, 'SMTP');

    await started;

    const current = storedRow(store);
    store.rows.set(current.id, {
      ...current,
      smtpPasswordEncrypted: encryptCredential('replaced-secret', KEY),
    });

    gate.resolve();

    const result = await pending;

    expect(result.result).toBe('CONFIGURATION_CHANGED');
    expect(storedRow(store).smtpVerificationStatus).toBe('NOT_TESTED');
  });

  it('does not persist an SMTP result when the account is disabled while testing', async () => {
    const row = accountRow({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T08:10:00.000Z'),
      imapVerificationStatus: 'FAILED',
      imapLastCheckedAt: new Date('2026-11-26T08:11:00.000Z'),
      imapVerificationFailureCode: 'TLS_FAILURE',
    });
    const store = createStore([row]);
    const gate = deferred<void>();
    let entered = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const service = verificationService(store, {
      smtpVerifier: {
        verify: async () => {
          entered();
          await gate.promise;
        },
      },
    });

    const pending = service.verify(row.id, 'SMTP');

    await started;

    const current = storedRow(store);
    store.rows.set(current.id, { ...current, enabled: false });

    gate.resolve();

    const result = await pending;
    const stored = storedRow(store);

    expect(result.result).toBe('CONFIGURATION_CHANGED');
    expect(result.failureCode).toBeNull();
    expect(result.lastCheckedAt).toBeNull();
    expect(result.account.enabled).toBe(false);
    expect(stored.enabled).toBe(false);
    expect(stored.smtpVerificationStatus).toBe('VERIFIED');
    expect(stored.smtpLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:10:00.000Z',
    );
    expect(stored.smtpVerificationFailureCode).toBeNull();
    expect(stored.imapVerificationStatus).toBe('FAILED');
    expect(stored.imapLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:11:00.000Z',
    );
    expect(stored.imapVerificationFailureCode).toBe('TLS_FAILURE');
  });

  it('does not persist an IMAP result when the account is disabled while testing', async () => {
    const row = accountRow({
      smtpVerificationStatus: 'VERIFIED',
      smtpLastCheckedAt: new Date('2026-11-26T08:20:00.000Z'),
      imapVerificationStatus: 'VERIFIED',
      imapLastCheckedAt: new Date('2026-11-26T08:30:00.000Z'),
    });
    const store = createStore([row]);
    const gate = deferred<void>();
    let entered = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const service = verificationService(store, {
      imapVerifier: {
        verify: async () => {
          entered();
          await gate.promise;
        },
      },
    });

    const pending = service.verify(row.id, 'IMAP');

    await started;

    const current = storedRow(store);
    store.rows.set(current.id, { ...current, enabled: false });

    gate.resolve();

    const result = await pending;
    const stored = storedRow(store);

    expect(result.result).toBe('CONFIGURATION_CHANGED');
    expect(result.failureCode).toBeNull();
    expect(result.lastCheckedAt).toBeNull();
    expect(result.account.enabled).toBe(false);
    expect(stored.enabled).toBe(false);
    expect(stored.imapVerificationStatus).toBe('VERIFIED');
    expect(stored.imapLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:30:00.000Z',
    );
    expect(stored.imapVerificationFailureCode).toBeNull();
    expect(stored.smtpVerificationStatus).toBe('VERIFIED');
    expect(stored.smtpLastCheckedAt?.toISOString()).toBe(
      '2026-11-26T08:20:00.000Z',
    );
  });

  it('returns the persisted result and the safe account together', async () => {
    const row = accountRow();
    const store = createStore([row]);
    const service = verificationService(store);

    const result: ConnectionVerificationResult = await service.verify(
      row.id,
      'IMAP',
    );

    expect(result.accountId).toBe(row.id);
    expect(result.account.imapVerificationStatus).toBe('VERIFIED');
    expect(result.account.imapLastCheckedAt).toBe(result.lastCheckedAt);
    expect(result.account.imapPasswordConfigured).toBe(true);
    expect(
      Object.keys(result.account).some((key) => key.includes('Encrypted')),
    ).toBe(false);
  });
});
