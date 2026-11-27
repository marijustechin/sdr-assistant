import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateResearchEmailAccountDto } from '../src/modules/research-communication/dto/update-research-email-account.dto';
import { UpdateResearchInitialEmailDto } from '../src/modules/research-communication/dto/update-research-initial-email.dto';
import { ResearchCommunicationService } from '../src/modules/research-communication/research-communication.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Synthetic, in-memory Prisma stand-in. It records the writes and never opens a
 * database connection. Account rows deliberately carry credential ciphertext so
 * the tests can prove the communication responses never expose it.
 */
type AccountRow = {
  readonly id: string;
  readonly name: string;
  readonly emailAddress: string;
  readonly enabled: boolean;
  readonly smtpPasswordEncrypted: string;
  readonly imapPasswordEncrypted: string;
};

type SettingsRow = {
  researchId: string;
  emailAccountId: string | null;
  initialEmailSubject: string | null;
  initialEmailBody: string | null;
  recipientQueueSourceRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SettingsUpsertArgs = {
  where: { researchId: string };
  create: {
    researchId: string;
    emailAccountId?: string | null;
    initialEmailSubject?: string;
    initialEmailBody?: string;
    recipientQueueSourceRunId?: string;
  };
  update: {
    emailAccountId?: string | null;
    initialEmailSubject?: string;
    initialEmailBody?: string;
    recipientQueueSourceRunId?: string;
  };
  select?: { emailAccountId: true };
};

const ENABLED_ACCOUNT: AccountRow = {
  id: 'account-1',
  name: 'Outreach mailbox',
  emailAddress: 'sales@example.test',
  enabled: true,
  smtpPasswordEncrypted: 'v1.synthetic-smtp-ciphertext',
  imapPasswordEncrypted: 'v1.synthetic-imap-ciphertext',
};

const SECOND_ACCOUNT: AccountRow = {
  ...ENABLED_ACCOUNT,
  id: 'account-2',
  name: 'Second mailbox',
  emailAddress: 'second@example.test',
};

const DISABLED_ACCOUNT: AccountRow = {
  ...ENABLED_ACCOUNT,
  id: 'account-disabled',
  name: 'Disabled mailbox',
  enabled: false,
};

type StoreOptions = {
  readonly researches?: readonly string[];
  readonly accounts?: readonly AccountRow[];
  readonly settings?: readonly {
    readonly researchId: string;
    readonly emailAccountId: string | null;
    readonly initialEmailSubject?: string | null;
    readonly initialEmailBody?: string | null;
  }[];
};

function createStore(options: StoreOptions = {}) {
  const researches = new Set(options.researches ?? ['research-1', 'research-2']);
  const accounts = new Map(
    (options.accounts ?? [ENABLED_ACCOUNT]).map((account) => [
      account.id,
      account,
    ]),
  );
  const settings = new Map<string, SettingsRow>();
  const upserts: SettingsUpsertArgs[] = [];
  let clock = 0;

  for (const setting of options.settings ?? []) {
    clock += 1;
    const timestamp = new Date(Date.UTC(2026, 10, 27, 10, clock));

    settings.set(setting.researchId, {
      researchId: setting.researchId,
      emailAccountId: setting.emailAccountId,
      initialEmailSubject: setting.initialEmailSubject ?? null,
      initialEmailBody: setting.initialEmailBody ?? null,
      recipientQueueSourceRunId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const prisma = {
    research: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        researches.has(where.id) ? { id: where.id } : null,
    },
    emailAccount: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const account = accounts.get(where.id);

        return account === undefined ? null : { enabled: account.enabled };
      },
    },
    researchCommunicationSettings: {
      findUnique: async ({ where }: { where: { researchId: string } }) => {
        const row = settings.get(where.researchId);
        if (row === undefined) return null;

        return {
          emailAccountId: row.emailAccountId,
          initialEmailSubject: row.initialEmailSubject,
          initialEmailBody: row.initialEmailBody,
          recipientQueueSourceRunId: row.recipientQueueSourceRunId,
        };
      },
      upsert: async (args: SettingsUpsertArgs) => {
        const existing = settings.get(args.where.researchId);
        clock += 1;
        const timestamp = new Date(Date.UTC(2026, 10, 27, 11, clock));

        if (existing === undefined) {
          settings.set(args.where.researchId, {
            researchId: args.where.researchId,
            emailAccountId: args.create.emailAccountId ?? null,
            initialEmailSubject: args.create.initialEmailSubject ?? null,
            initialEmailBody: args.create.initialEmailBody ?? null,
            recipientQueueSourceRunId:
              args.create.recipientQueueSourceRunId ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        } else {
          Object.assign(existing, args.update, { updatedAt: timestamp });
        }

        upserts.push(args);

        return settings.get(args.where.researchId);
      },
    },
  } as unknown as PrismaService;

  return { prisma, researches, accounts, settings, upserts };
}

function serviceFor(options: StoreOptions = {}) {
  const store = createStore(options);

  return {
    ...store,
    service: new ResearchCommunicationService(store.prisma),
  };
}

async function validateAccountDto(
  payload: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(UpdateResearchEmailAccountDto, payload));
}

async function validateInitialEmailDto(
  payload: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(UpdateResearchInitialEmailDto, payload));
}

function propertyNames(errors: readonly ValidationError[]): string[] {
  return errors.map((error) => error.property);
}

describe('research communication settings', () => {
  it('returns no assignment and no initial email for a research without saved settings', async () => {
    const { service } = serviceFor();

    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: null,
      initialEmail: null,
    });
  });

  it('assigns an enabled account and stores exactly the assignment', async () => {
    const { service, settings, upserts } = serviceFor();

    await expect(
      service.updateEmailAccountAssignment('research-1', 'account-1'),
    ).resolves.toEqual({ emailAccountId: 'account-1' });

    expect(settings.get('research-1')?.emailAccountId).toBe('account-1');
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.create).toEqual({
      researchId: 'research-1',
      emailAccountId: 'account-1',
    });
    expect(upserts[0]?.update).toEqual({ emailAccountId: 'account-1' });
  });

  it('restores a saved assignment', async () => {
    const { service } = serviceFor({
      settings: [{ researchId: 'research-1', emailAccountId: 'account-1' }],
    });

    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: 'account-1',
      initialEmail: null,
    });
  });

  it('changes and removes an existing assignment', async () => {
    const { service, settings } = serviceFor({
      accounts: [ENABLED_ACCOUNT, SECOND_ACCOUNT],
      settings: [{ researchId: 'research-1', emailAccountId: 'account-1' }],
    });

    await expect(
      service.updateEmailAccountAssignment('research-1', 'account-2'),
    ).resolves.toEqual({ emailAccountId: 'account-2' });
    expect(settings.get('research-1')?.emailAccountId).toBe('account-2');

    await expect(
      service.updateEmailAccountAssignment('research-1', null),
    ).resolves.toEqual({ emailAccountId: null });
    expect(settings.get('research-1')?.emailAccountId).toBeNull();
    expect(settings.size).toBe(1);
  });

  it('removes an assignment even when no settings row exists yet', async () => {
    const { service, settings } = serviceFor();

    await expect(
      service.updateEmailAccountAssignment('research-1', null),
    ).resolves.toEqual({ emailAccountId: null });
    expect(settings.get('research-1')?.emailAccountId).toBeNull();
  });

  it('allows multiple researches to share the same account', async () => {
    const { service, settings } = serviceFor();

    await service.updateEmailAccountAssignment('research-1', 'account-1');
    await service.updateEmailAccountAssignment('research-2', 'account-1');

    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: 'account-1',
      initialEmail: null,
    });
    await expect(service.getCommunicationSettings('research-2')).resolves.toEqual({
      emailAccountId: 'account-1',
      initialEmail: null,
    });
    expect(settings.size).toBe(2);
  });

  it('is idempotent when the same account is assigned again', async () => {
    const { service, settings } = serviceFor();

    await service.updateEmailAccountAssignment('research-1', 'account-1');
    await service.updateEmailAccountAssignment('research-1', 'account-1');

    expect(settings.size).toBe(1);
    expect(settings.get('research-1')?.emailAccountId).toBe('account-1');
  });

  it('keeps an assigned disabled account and refuses to assign a disabled one', async () => {
    const { service } = serviceFor({
      accounts: [ENABLED_ACCOUNT, DISABLED_ACCOUNT],
      settings: [
        { researchId: 'research-1', emailAccountId: 'account-disabled' },
      ],
    });

    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: 'account-disabled',
      initialEmail: null,
    });

    await expect(
      service.updateEmailAccountAssignment('research-1', 'account-disabled'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown email account', async () => {
    const { service, settings } = serviceFor();

    await expect(
      service.updateEmailAccountAssignment('research-1', 'missing-account'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(settings.size).toBe(0);
  });

  it('rejects an unknown research on read and write', async () => {
    const { service } = serviceFor({ researches: ['research-1'] });

    await expect(
      service.getCommunicationSettings('missing-research'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateEmailAccountAssignment('missing-research', 'account-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateInitialEmail('missing-research', 'Subject', 'Body'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never returns account configuration or credential material', async () => {
    const { service } = serviceFor();

    const assignment = await service.updateEmailAccountAssignment(
      'research-1',
      'account-1',
    );
    const settings = await service.getCommunicationSettings('research-1');

    expect(Object.keys(assignment)).toEqual(['emailAccountId']);
    for (const payload of [assignment, settings]) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('ciphertext');
      expect(serialized).not.toContain('smtp');
      expect(serialized).not.toContain('imap');
      expect(serialized).not.toContain(ENABLED_ACCOUNT.emailAddress);
    }
  });
});

describe('research initial email', () => {
  it('saves the subject and plain-text body, restoring them on read', async () => {
    const { service, settings } = serviceFor();

    await expect(
      service.updateInitialEmail(
        'research-1',
        '  Supply partnership  ',
        '  Hello,\n\nWe would like to discuss supply.\n  ',
      ),
    ).resolves.toEqual({
      subject: 'Supply partnership',
      body: 'Hello,\n\nWe would like to discuss supply.',
    });

    const row = settings.get('research-1');
    expect(row?.initialEmailSubject).toBe('Supply partnership');
    expect(row?.initialEmailBody).toBe(
      'Hello,\n\nWe would like to discuss supply.',
    );

    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: null,
      initialEmail: {
        subject: 'Supply partnership',
        body: 'Hello,\n\nWe would like to discuss supply.',
      },
    });
  });

  it('updates an existing initial email without touching the assignment', async () => {
    const { service, settings } = serviceFor({
      settings: [
        {
          researchId: 'research-1',
          emailAccountId: 'account-1',
          initialEmailSubject: 'First subject',
          initialEmailBody: 'First body',
        },
      ],
    });

    await service.updateInitialEmail('research-1', 'Second subject', 'Second body');

    expect(settings.get('research-1')?.emailAccountId).toBe('account-1');
    expect(settings.get('research-1')?.initialEmailSubject).toBe('Second subject');
    expect(settings.get('research-1')?.initialEmailBody).toBe('Second body');
  });

  it('keeps the initial email when the assignment changes or is removed', async () => {
    const { service } = serviceFor({
      accounts: [ENABLED_ACCOUNT, SECOND_ACCOUNT],
      settings: [
        {
          researchId: 'research-1',
          emailAccountId: 'account-1',
          initialEmailSubject: 'Subject',
          initialEmailBody: 'Body',
        },
      ],
    });

    await service.updateEmailAccountAssignment('research-1', 'account-2');
    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: 'account-2',
      initialEmail: { subject: 'Subject', body: 'Body' },
    });

    await service.updateEmailAccountAssignment('research-1', null);
    await expect(service.getCommunicationSettings('research-1')).resolves.toEqual({
      emailAccountId: null,
      initialEmail: { subject: 'Subject', body: 'Body' },
    });
  });

  it('rejects a blank subject or body', async () => {
    const { service } = serviceFor();

    await expect(
      service.updateInitialEmail('research-1', '   ', 'Body'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateInitialEmail('research-1', 'Subject', ' \n '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an over-long subject or body', async () => {
    const { service } = serviceFor();

    await expect(
      service.updateInitialEmail('research-1', 'x'.repeat(301), 'Body'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateInitialEmail('research-1', 'Subject', 'x'.repeat(20_001)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateResearchEmailAccountDto validation', () => {
  it('accepts a non-empty account id', async () => {
    await expect(
      validateAccountDto({ emailAccountId: 'account-1' }),
    ).resolves.toHaveLength(0);
  });

  it('accepts null as the explicit removal value', async () => {
    await expect(
      validateAccountDto({ emailAccountId: null }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a missing, non-string, empty or over-long value', async () => {
    const missing = await validateAccountDto({});
    const nonString = await validateAccountDto({ emailAccountId: 42 });
    const empty = await validateAccountDto({ emailAccountId: '' });
    const tooLong = await validateAccountDto({ emailAccountId: 'x'.repeat(192) });

    expect(propertyNames(missing)).toEqual(['emailAccountId']);
    expect(propertyNames(nonString)).toEqual(['emailAccountId']);
    expect(propertyNames(empty)).toEqual(['emailAccountId']);
    expect(propertyNames(tooLong)).toEqual(['emailAccountId']);
  });
});

describe('UpdateResearchInitialEmailDto validation', () => {
  it('accepts a plain-text subject and body', async () => {
    await expect(
      validateInitialEmailDto({
        subject: 'Supply partnership',
        body: 'Hello,\n\nWe would like to discuss supply.',
      }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a missing, empty, non-string or over-long value', async () => {
    expect(propertyNames(await validateInitialEmailDto({ body: 'Body' }))).toEqual([
      'subject',
    ]);
    expect(
      propertyNames(
        await validateInitialEmailDto({ subject: 'Subject', body: '' }),
      ),
    ).toEqual(['body']);
    expect(
      propertyNames(
        await validateInitialEmailDto({ subject: 42, body: 'Body' }),
      ),
    ).toEqual(['subject']);
    expect(
      propertyNames(
        await validateInitialEmailDto({
          subject: 'x'.repeat(301),
          body: 'Body',
        }),
      ),
    ).toEqual(['subject']);
    expect(
      propertyNames(
        await validateInitialEmailDto({
          subject: 'Subject',
          body: 'x'.repeat(20_001),
        }),
      ),
    ).toEqual(['body']);
  });
});
