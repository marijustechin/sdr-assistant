import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { UpdateResearchEmailAccountDto } from '../src/modules/research-communication/dto/update-research-email-account.dto';
import { ResearchCommunicationService } from '../src/modules/research-communication/research-communication.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Synthetic, in-memory Prisma stand-in. It records the writes and never opens a
 * database connection. Account rows deliberately carry credential ciphertext so
 * the tests can prove the assignment response never exposes it.
 */
type AccountRow = {
  readonly id: string;
  readonly name: string;
  readonly emailAddress: string;
  readonly enabled: boolean;
  readonly smtpPasswordEncrypted: string;
  readonly imapPasswordEncrypted: string;
};

type CommunicationRow = {
  researchId: string;
  emailAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UpsertArgs = {
  where: { researchId: string };
  create: { researchId: string; emailAccountId: string | null };
  update: { emailAccountId: string | null };
  select: { emailAccountId: true };
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
  const settings = new Map<string, CommunicationRow>();
  const upserts: UpsertArgs[] = [];
  let clock = 0;

  for (const setting of options.settings ?? []) {
    clock += 1;
    const timestamp = new Date(Date.UTC(2026, 10, 27, 10, clock));

    settings.set(setting.researchId, {
      researchId: setting.researchId,
      emailAccountId: setting.emailAccountId,
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
      findUnique: async ({
        where,
      }: {
        where: { researchId: string };
        select: { emailAccountId: true };
      }) => {
        const row = settings.get(where.researchId);

        return row === undefined ? null : { emailAccountId: row.emailAccountId };
      },
      upsert: async (args: UpsertArgs) => {
        const existing = settings.get(args.where.researchId);
        clock += 1;
        const timestamp = new Date(Date.UTC(2026, 10, 27, 11, clock));

        if (existing === undefined) {
          settings.set(args.where.researchId, {
            researchId: args.where.researchId,
            emailAccountId: args.create.emailAccountId,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        } else {
          existing.emailAccountId = args.update.emailAccountId;
          existing.updatedAt = timestamp;
        }

        upserts.push(args);

        return {
          emailAccountId:
            settings.get(args.where.researchId)?.emailAccountId ?? null,
        };
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

async function validateDto(
  payload: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(UpdateResearchEmailAccountDto, payload));
}

describe('research email-account assignment', () => {
  it('returns no assignment for a research without saved settings', async () => {
    const { service } = serviceFor();

    await expect(
      service.getEmailAccountAssignment('research-1'),
    ).resolves.toEqual({ emailAccountId: null });
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

    await expect(
      service.getEmailAccountAssignment('research-1'),
    ).resolves.toEqual({ emailAccountId: 'account-1' });
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

    await expect(
      service.getEmailAccountAssignment('research-1'),
    ).resolves.toEqual({ emailAccountId: 'account-1' });
    await expect(
      service.getEmailAccountAssignment('research-2'),
    ).resolves.toEqual({ emailAccountId: 'account-1' });
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

    await expect(
      service.getEmailAccountAssignment('research-1'),
    ).resolves.toEqual({ emailAccountId: 'account-disabled' });

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
      service.getEmailAccountAssignment('missing-research'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateEmailAccountAssignment('missing-research', 'account-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never returns account configuration or credential material', async () => {
    const { service } = serviceFor();

    const assignment = await service.updateEmailAccountAssignment(
      'research-1',
      'account-1',
    );

    expect(Object.keys(assignment)).toEqual(['emailAccountId']);
    expect(JSON.stringify(assignment)).not.toContain('ciphertext');
    expect(JSON.stringify(assignment)).not.toContain('smtp');
    expect(JSON.stringify(assignment)).not.toContain('imap');
    expect(JSON.stringify(assignment)).not.toContain(ENABLED_ACCOUNT.emailAddress);
  });
});

describe('UpdateResearchEmailAccountDto validation', () => {
  it('accepts a non-empty account id', async () => {
    await expect(
      validateDto({ emailAccountId: 'account-1' }),
    ).resolves.toHaveLength(0);
  });

  it('accepts null as the explicit removal value', async () => {
    await expect(
      validateDto({ emailAccountId: null }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a missing, non-string, empty or over-long value', async () => {
    const missing = await validateDto({});
    const nonString = await validateDto({ emailAccountId: 42 });
    const empty = await validateDto({ emailAccountId: '' });
    const tooLong = await validateDto({ emailAccountId: 'x'.repeat(192) });

    expect(missing.map((error) => error.property)).toEqual(['emailAccountId']);
    expect(nonString.map((error) => error.property)).toEqual(['emailAccountId']);
    expect(empty.map((error) => error.property)).toEqual(['emailAccountId']);
    expect(tooLong.map((error) => error.property)).toEqual(['emailAccountId']);
  });
});
