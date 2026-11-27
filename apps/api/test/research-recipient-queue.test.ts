import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ResearchCommunicationService } from '../src/modules/research-communication/research-communication.service';
import {
  classifyMailbox,
  normalizeCompanyDomain,
  normalizePublishedEmail,
  selectRecipients,
  usablePublishedEmails,
} from '../src/modules/research-communication/research-recipient-selection';
import {
  DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
  parseRecipientQueueQuery,
} from '../src/modules/research-communication/research-recipient-queue.query';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

type Ownership = 'usable' | 'partner' | 'uncertain';

type ResultRow = {
  readonly id: string;
  readonly runId: string;
  readonly sourceCompanyIndex: number;
  readonly domain: string;
  readonly companyName: string | null;
  readonly decision: 'ACCEPTED' | 'EXCLUDED';
  readonly metadata: unknown;
};

type RunRow = {
  readonly id: string;
  readonly researchId: string;
  publishedAt: Date | null;
};

type RecipientRow = {
  id: string;
  researchId: string;
  sourceRunId: string;
  sourceResultId: string;
  sourceCompanyIndex: number;
  domain: string;
  companyName: string | null;
  primaryEmail: string;
  alternativeEmails: string[];
  selectionReason: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
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

function contactMetadata(
  emails: ReadonlyArray<{ readonly value: string; readonly ownership?: Ownership }>,
): unknown {
  return {
    contactDiscovery: {
      domain: 'synthetic.test',
      companyName: null,
      retained: true,
      exclusionReason: null,
      emails: emails.map((email) => ({
        value: email.value,
        ownership: email.ownership ?? 'usable',
        employeeName: null,
        employeePosition: null,
        employeeAssociation: 'unknown',
        sources: [],
      })),
      phones: [],
      addresses: [],
      registrationIdentifiers: [],
    },
  };
}

function accepted(input: {
  readonly index: number;
  readonly domain: string;
  readonly companyName?: string | null;
  readonly emails: ReadonlyArray<{
    readonly value: string;
    readonly ownership?: Ownership;
  }>;
  readonly runId?: string;
}): ResultRow {
  return {
    id: `result-${input.index}`,
    runId: input.runId ?? 'run-1',
    sourceCompanyIndex: input.index,
    domain: input.domain,
    companyName: input.companyName ?? null,
    decision: 'ACCEPTED',
    metadata: contactMetadata(input.emails),
  };
}

function excluded(input: {
  readonly index: number;
  readonly domain: string;
  readonly runId?: string;
}): ResultRow {
  return {
    id: `result-${input.index}`,
    runId: input.runId ?? 'run-1',
    sourceCompanyIndex: input.index,
    domain: input.domain,
    companyName: null,
    decision: 'EXCLUDED',
    metadata: contactMetadata([
      { value: `info@${input.domain}`, ownership: 'usable' },
    ]),
  };
}

type StoreOptions = {
  readonly researches?: readonly string[];
  readonly runs?: readonly RunRow[];
  readonly results?: readonly ResultRow[];
  readonly settings?: readonly {
    readonly researchId: string;
    readonly recipientQueueSourceRunId?: string | null;
  }[];
};

const PUBLISHED_AT = new Date('2026-11-27T10:00:00.000Z');

function createStore(options: StoreOptions = {}) {
  const researches = new Set(options.researches ?? ['research-1']);
  const runs = new Map((options.runs ?? []).map((run) => [run.id, run]));
  const results = new Map(
    (options.results ?? []).map((result) => [result.id, result]),
  );
  const recipients = new Map<string, RecipientRow>();
  const settings = new Map<string, SettingsRow>();
  let clock = 0;
  let recipientSequence = 0;
  const calls = {
    createMany: 0,
    deleteMany: 0,
    prepareUpserts: 0,
  };

  for (const setting of options.settings ?? []) {
    clock += 1;
    const timestamp = new Date(Date.UTC(2026, 10, 27, 12, clock));
    settings.set(setting.researchId, {
      researchId: setting.researchId,
      emailAccountId: null,
      initialEmailSubject: null,
      initialEmailBody: null,
      recipientQueueSourceRunId: setting.recipientQueueSourceRunId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  function nextTimestamp(): Date {
    clock += 1;
    return new Date(Date.UTC(2026, 10, 27, 13, clock));
  }

  function filterRecipients(where: {
    researchId?: string;
    sourceRunId?: string;
    OR?: ReadonlyArray<Record<string, { contains?: string }>>;
    NOT?: { alternativeEmails?: { isEmpty?: boolean } };
  }): RecipientRow[] {
    const search =
      where.OR === undefined
        ? null
        : (where.OR.map(
            (clause) =>
              clause.companyName?.contains ??
              clause.domain?.contains ??
              clause.primaryEmail?.contains,
          ).find((value) => typeof value === 'string') ?? null);

    return [...recipients.values()].filter((row) => {
      if (where.researchId !== undefined && row.researchId !== where.researchId) {
        return false;
      }
      if (where.sourceRunId !== undefined && row.sourceRunId !== where.sourceRunId) {
        return false;
      }
      if (
        where.NOT?.alternativeEmails?.isEmpty === true &&
        row.alternativeEmails.length === 0
      ) {
        return false;
      }
      if (search !== null) {
        const haystack = [
          row.companyName ?? '',
          row.domain,
          row.primaryEmail,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }

  function sortRecipients(rows: RecipientRow[]): RecipientRow[] {
    return [...rows].sort((left, right) => {
      const leftName = left.companyName ?? '\uffff';
      const rightName = right.companyName ?? '\uffff';
      if (leftName < rightName) return -1;
      if (leftName > rightName) return 1;
      if (left.domain < right.domain) return -1;
      if (left.domain > right.domain) return 1;
      return 0;
    });
  }

  const prisma = {
    research: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        researches.has(where.id) ? { id: where.id } : null,
    },
    leadQualificationRun: {
      findFirst: async ({
        where,
      }: {
        where: { researchId: string; publishedAt: { not: null } };
      }) => {
        const published = [...runs.values()]
          .filter(
            (run) =>
              run.researchId === where.researchId && run.publishedAt !== null,
          )
          .sort(
            (left, right) =>
              (right.publishedAt?.getTime() ?? 0) -
              (left.publishedAt?.getTime() ?? 0),
          );

        return published[0] ?? null;
      },
    },
    leadQualificationResult: {
      findMany: async ({
        where,
      }: {
        where: { runId: string; decision: 'ACCEPTED' | 'EXCLUDED' };
      }) =>
        [...results.values()]
          .filter(
            (result) =>
              result.runId === where.runId &&
              result.decision === where.decision,
          )
          .sort(
            (left, right) =>
              left.sourceCompanyIndex - right.sourceCompanyIndex,
          ),
      count: async ({
        where,
      }: {
        where: { runId: string; decision: 'ACCEPTED' | 'EXCLUDED' };
      }) =>
        [...results.values()].filter(
          (result) =>
            result.runId === where.runId && result.decision === where.decision,
        ).length,
    },
    researchCommunicationSettings: {
      findUnique: async ({ where }: { where: { researchId: string } }) => {
        const row = settings.get(where.researchId);
        if (row === undefined) return null;

        return { recipientQueueSourceRunId: row.recipientQueueSourceRunId };
      },
      upsert: async (args: {
        where: { researchId: string };
        create: {
          researchId: string;
          recipientQueueSourceRunId: string;
        };
        update: { recipientQueueSourceRunId: string };
      }) => {
        calls.prepareUpserts += 1;
        const existing = settings.get(args.where.researchId);
        const timestamp = nextTimestamp();

        if (existing === undefined) {
          settings.set(args.where.researchId, {
            researchId: args.where.researchId,
            emailAccountId: null,
            initialEmailSubject: null,
            initialEmailBody: null,
            recipientQueueSourceRunId: args.create.recipientQueueSourceRunId,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        } else {
          existing.recipientQueueSourceRunId =
            args.update.recipientQueueSourceRunId;
          existing.updatedAt = timestamp;
        }

        return settings.get(args.where.researchId);
      },
    },
    researchRecipient: {
      deleteMany: async ({ where }: { where: { researchId: string } }) => {
        calls.deleteMany += 1;
        let count = 0;
        for (const [id, row] of recipients) {
          if (row.researchId === where.researchId) {
            recipients.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      createMany: async ({
        data,
      }: {
        data: ReadonlyArray<{
          researchId: string;
          sourceRunId: string;
          sourceResultId: string;
          sourceCompanyIndex: number;
          domain: string;
          companyName: string | null;
          primaryEmail: string;
          alternativeEmails: string[];
          selectionReason: string;
          status: string;
        }>;
      }) => {
        calls.createMany += 1;
        const timestamp = nextTimestamp();
        for (const item of data) {
          recipientSequence += 1;
          recipients.set(`recipient-${recipientSequence}`, {
            id: `recipient-${recipientSequence}`,
            researchId: item.researchId,
            sourceRunId: item.sourceRunId,
            sourceResultId: item.sourceResultId,
            sourceCompanyIndex: item.sourceCompanyIndex,
            domain: item.domain,
            companyName: item.companyName,
            primaryEmail: item.primaryEmail,
            alternativeEmails: [...item.alternativeEmails],
            selectionReason: item.selectionReason,
            status: item.status,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
        return { count: data.length };
      },
      count: async ({ where }: { where: { researchId: string } }) =>
        filterRecipients(where).length,
      findMany: async ({
        where,
        skip,
        take,
      }: {
        where: { researchId: string };
        orderBy?: unknown;
        skip?: number;
        take?: number;
        select?: unknown;
      }) => {
        const sorted = sortRecipients(filterRecipients(where));
        const start = skip ?? 0;
        return take === undefined
          ? sorted.slice(start)
          : sorted.slice(start, start + take);
      },
    },
    $transaction: async <T>(
      callback: (transaction: unknown) => Promise<T>,
    ): Promise<T> => callback(prisma),
  };

  return {
    prisma: prisma as unknown as PrismaService,
    researches,
    runs,
    results,
    recipients,
    settings,
    calls,
  };
}

function serviceFor(options: StoreOptions = {}) {
  const store = createStore(options);

  return {
    ...store,
    service: new ResearchCommunicationService(store.prisma),
  };
}

function queueOptions(overrides: Partial<{ q: string; page: number; pageSize: number }> = {}) {
  return {
    q: '',
    page: 1,
    pageSize: DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
    ...overrides,
  };
}

describe('mailbox classification', () => {
  it('classifies sales and commercial local parts first', () => {
    expect(classifyMailbox('sales@alpha.test')).toBe('SALES_DEPARTMENT');
    expect(classifyMailbox('sales.lt@alpha.test')).toBe('SALES_DEPARTMENT');
    expect(classifyMailbox('pardavimai@alpha.test')).toBe('SALES_DEPARTMENT');
    expect(classifyMailbox('commercial@alpha.test')).toBe('SALES_DEPARTMENT');
    expect(classifyMailbox('export@alpha.test')).toBe('SALES_DEPARTMENT');
  });

  it('classifies general company mailboxes second', () => {
    expect(classifyMailbox('info@alpha.test')).toBe('GENERAL_MAILBOX');
    expect(classifyMailbox('office@alpha.test')).toBe('GENERAL_MAILBOX');
    expect(classifyMailbox('kontaktai@alpha.test')).toBe('GENERAL_MAILBOX');
    expect(classifyMailbox('hello@alpha.test')).toBe('GENERAL_MAILBOX');
    expect(classifyMailbox('team@alpha.test')).toBe('GENERAL_MAILBOX');
  });

  it('falls back to an individual contact and ignores plus tags', () => {
    expect(classifyMailbox('jonas@alpha.test')).toBe('INDIVIDUAL_CONTACT');
    expect(classifyMailbox('sales+outreach@alpha.test')).toBe(
      'SALES_DEPARTMENT',
    );
  });
});

describe('published email extraction', () => {
  it('keeps only usable, normalized, de-duplicated addresses', () => {
    expect(
      usablePublishedEmails(
        contactMetadata([
          { value: 'Sales@Alpha.Test' },
          { value: ' sales@alpha.test ' },
          { value: 'info@alpha.test' },
          { value: 'partner@distributor.test', ownership: 'partner' },
          { value: 'unknown@alpha.test', ownership: 'uncertain' },
        ]),
      ),
    ).toEqual(['sales@alpha.test', 'info@alpha.test']);
  });

  it('returns nothing for a malformed or missing contact payload', () => {
    expect(usablePublishedEmails(null)).toEqual([]);
    expect(usablePublishedEmails({})).toEqual([]);
    expect(usablePublishedEmails({ contactDiscovery: { emails: 'nope' } })).toEqual(
      [],
    );
    expect(
      usablePublishedEmails({ contactDiscovery: { emails: [{ value: 'x' }] } }),
    ).toEqual([]);
  });

  it('normalizes email values and company domains', () => {
    expect(normalizePublishedEmail(' Info@Example.TEST ')).toBe(
      'info@example.test',
    );
    expect(normalizePublishedEmail('not-an-email')).toBeNull();
    expect(normalizeCompanyDomain(' HTTPS://WWW.Example.Test/contact ')).toBe(
      'www.example.test',
    );
  });
});

describe('deterministic recipient selection', () => {
  it('selects the sales mailbox first and keeps the other usable addresses', () => {
    const selected = selectRecipients([
      accepted({
        index: 0,
        domain: 'alpha.test',
        companyName: 'Alpha',
        emails: [
          { value: 'info@alpha.test' },
          { value: 'sales@alpha.test' },
          { value: 'partner@distributor.test', ownership: 'partner' },
          { value: 'unknown@alpha.test', ownership: 'uncertain' },
        ],
      }),
    ]);

    expect(selected).toEqual([
      {
        sourceResultId: 'result-0',
        sourceCompanyIndex: 0,
        domain: 'alpha.test',
        companyName: 'Alpha',
        primaryEmail: 'sales@alpha.test',
        alternativeEmails: ['info@alpha.test'],
        selectionReason: 'SALES_DEPARTMENT',
        status: 'PREPARED',
      },
    ]);
  });

  it('uses the general mailbox tier, then the individual tier', () => {
    const selected = selectRecipients([
      accepted({
        index: 0,
        domain: 'beta.test',
        emails: [{ value: 'office@beta.test' }, { value: 'jonas@beta.test' }],
      }),
      accepted({
        index: 1,
        domain: 'gamma.test',
        emails: [{ value: 'jonas@gamma.test' }],
      }),
    ]);

    expect(selected.map((item) => [item.primaryEmail, item.selectionReason])).toEqual([
      ['office@beta.test', 'GENERAL_MAILBOX'],
      ['jonas@gamma.test', 'INDIVIDUAL_CONTACT'],
    ]);
  });

  it('prefers the company domain, then the lexicographically smallest address', () => {
    const selected = selectRecipients([
      accepted({
        index: 0,
        domain: 'brand.test',
        emails: [
          { value: 'sales@group.test' },
          { value: 'sales@brand.test' },
          { value: 'info@brand.test' },
        ],
      }),
      accepted({
        index: 1,
        domain: 'other.test',
        emails: [{ value: 'office@other.test' }, { value: 'info@other.test' }],
      }),
    ]);

    expect(selected[0]?.primaryEmail).toBe('sales@brand.test');
    expect(selected[0]?.alternativeEmails).toEqual([
      'sales@group.test',
      'info@brand.test',
    ]);
    expect(selected[1]?.primaryEmail).toBe('info@other.test');
  });

  it('never reuses a primary address within one research', () => {
    const selected = selectRecipients([
      accepted({
        index: 0,
        domain: 'first.test',
        emails: [{ value: 'info@shared.test' }],
      }),
      accepted({
        index: 1,
        domain: 'second.test',
        emails: [
          { value: 'info@shared.test' },
          { value: 'sales@second.test' },
        ],
      }),
      accepted({
        index: 2,
        domain: 'third.test',
        emails: [{ value: 'info@shared.test' }],
      }),
    ]);

    expect(selected.map((item) => [item.domain, item.primaryEmail])).toEqual([
      ['first.test', 'info@shared.test'],
      ['second.test', 'sales@second.test'],
    ]);
    expect(selected[1]?.alternativeEmails).toEqual(['info@shared.test']);
  });

  it('keeps one entry per domain and skips companies without usable email', () => {
    const selected = selectRecipients([
      accepted({
        index: 0,
        domain: 'duplicate.test',
        emails: [{ value: 'info@duplicate.test' }],
      }),
      accepted({
        index: 1,
        domain: 'duplicate.test',
        emails: [{ value: 'sales@duplicate.test' }],
      }),
      accepted({
        index: 2,
        domain: 'no-email.test',
        emails: [{ value: 'partner@distributor.test', ownership: 'partner' }],
      }),
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0]?.primaryEmail).toBe('info@duplicate.test');
  });
});

describe('recipient queue preparation', () => {
  function baseOptions(): StoreOptions {
    return {
      runs: [
        { id: 'run-1', researchId: 'research-1', publishedAt: PUBLISHED_AT },
      ],
      results: [
        accepted({
          index: 0,
          domain: 'alpha.test',
          companyName: 'Alpha',
          emails: [
            { value: 'info@alpha.test' },
            { value: 'sales@alpha.test' },
            { value: 'partner@distributor.test', ownership: 'partner' },
          ],
        }),
        accepted({
          index: 1,
          domain: 'beta.test',
          companyName: 'Beta',
          emails: [{ value: 'hello@beta.test' }],
        }),
        accepted({
          index: 2,
          domain: 'no-email.test',
          companyName: 'No email',
          emails: [{ value: 'uncertain@no-email.test', ownership: 'uncertain' }],
        }),
        excluded({ index: 3, domain: 'excluded.test' }),
      ],
    };
  }

  it('prepares one primary recipient per retained company and excludes partners', async () => {
    const { service, recipients, settings } = serviceFor(baseOptions());

    const queue = await service.prepareRecipientQueue('research-1');

    expect(queue.publication).toEqual({
      runId: 'run-1',
      publishedAt: PUBLISHED_AT.toISOString(),
    });
    expect(queue.prepared).toBe(true);
    expect(queue.totals).toEqual({
      retainedCompanies: 3,
      preparedRecipients: 2,
      alternativeContacts: 1,
    });
    expect(queue.totalItems).toBe(2);
    expect(queue.items.map((item) => item.primaryEmail)).toEqual([
      'sales@alpha.test',
      'hello@beta.test',
    ]);
    expect(queue.items[0]?.alternativeEmails).toEqual(['info@alpha.test']);
    expect(queue.items.every((item) => item.status === 'PREPARED')).toBe(true);
    expect(
      queue.items.some((item) => item.primaryEmail.includes('partner')),
    ).toBe(false);
    expect(
      [...recipients.values()].some((row) => row.domain === 'excluded.test'),
    ).toBe(false);
    expect(settings.get('research-1')?.recipientQueueSourceRunId).toBe('run-1');
  });

  it('is idempotent: a repeated preparation writes nothing and creates no duplicates', async () => {
    const { service, recipients, calls } = serviceFor(baseOptions());

    const first = await service.prepareRecipientQueue('research-1');
    const second = await service.prepareRecipientQueue('research-1');

    expect(recipients.size).toBe(2);
    expect(calls.createMany).toBe(1);
    expect(calls.deleteMany).toBe(1);
    expect(second.items).toEqual(first.items);
    expect(second.totals).toEqual(first.totals);
    expect(new Set([...recipients.values()].map((row) => row.domain)).size).toBe(
      recipients.size,
    );
    expect(
      new Set([...recipients.values()].map((row) => row.primaryEmail)).size,
    ).toBe(recipients.size);
  });

  it('replaces the prepared set when a newer publication exists', async () => {
    const store = serviceFor(baseOptions());
    const { service } = store;

    const first = await service.prepareRecipientQueue('research-1');
    expect(first.publication?.runId).toBe('run-1');
    expect(first.items.map((item) => item.primaryEmail)).toEqual([
      'sales@alpha.test',
      'hello@beta.test',
    ]);

    // A newer Stage 05 publication supersedes run-1 and retains only Alpha.
    store.runs.set('run-2', {
      id: 'run-2',
      researchId: 'research-1',
      publishedAt: new Date('2026-11-27T11:00:00.000Z'),
    });
    store.runs.get('run-1')!.publishedAt = null;
    store.results.set(
      'result-10',
      accepted({
        index: 10,
        runId: 'run-2',
        domain: 'alpha.test',
        companyName: 'Alpha renewed',
        emails: [{ value: 'sales@alpha.test' }],
      }),
    );

    const second = await service.prepareRecipientQueue('research-1');

    expect(second.publication?.runId).toBe('run-2');
    expect(second.items.map((item) => item.primaryEmail)).toEqual([
      'sales@alpha.test',
    ]);
    expect(second.totals).toEqual({
      retainedCompanies: 1,
      preparedRecipients: 1,
      alternativeContacts: 0,
    });
    expect([...store.recipients.values()].map((row) => row.sourceRunId)).toEqual([
      'run-2',
    ]);
    expect(store.settings.get('research-1')?.recipientQueueSourceRunId).toBe(
      'run-2',
    );
  });

  it('does not write or delete anything without a published result', async () => {
    const { service, recipients, calls } = serviceFor({
      researches: ['research-1', 'research-2'],
      runs: [
        { id: 'run-1', researchId: 'research-1', publishedAt: PUBLISHED_AT },
      ],
      results: baseOptions().results,
    });

    await service.prepareRecipientQueue('research-1');
    const before = recipients.size;

    const queue = await service.prepareRecipientQueue('research-2');

    expect(queue).toEqual({
      publication: null,
      prepared: false,
      totals: {
        retainedCompanies: 0,
        preparedRecipients: 0,
        alternativeContacts: 0,
      },
      items: [],
      page: 1,
      pageSize: DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
      totalItems: 0,
    });
    expect(recipients.size).toBe(before);
    expect(calls.deleteMany).toBe(1);
  });

  it('reads without preparing and reports the unpublished marker', async () => {
    const { service, recipients, calls } = serviceFor(baseOptions());

    const queue = await service.getRecipientQueue('research-1', queueOptions());

    expect(queue.prepared).toBe(false);
    expect(queue.publication?.runId).toBe('run-1');
    expect(queue.items).toEqual([]);
    expect(queue.totals).toEqual({
      retainedCompanies: 3,
      preparedRecipients: 0,
      alternativeContacts: 0,
    });
    expect(recipients.size).toBe(0);
    expect(calls.createMany).toBe(0);
  });

  it('marks an empty prepared queue as prepared without inventing recipients', async () => {
    const { service } = serviceFor({
      runs: [
        { id: 'run-1', researchId: 'research-1', publishedAt: PUBLISHED_AT },
      ],
      results: [excluded({ index: 0, domain: 'excluded.test' })],
    });

    const queue = await service.prepareRecipientQueue('research-1');

    expect(queue.prepared).toBe(true);
    expect(queue.publication?.runId).toBe('run-1');
    expect(queue.totals).toEqual({
      retainedCompanies: 0,
      preparedRecipients: 0,
      alternativeContacts: 0,
    });
    expect(queue.items).toEqual([]);
  });

  it('rejects an unknown research', async () => {
    const { service } = serviceFor({ researches: ['research-1'] });

    await expect(
      service.prepareRecipientQueue('missing-research'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getRecipientQueue('missing-research', queueOptions()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('recipient queue search and pagination', () => {
  const COMPANY_COUNT = 2_000;

  function manyCompaniesOptions(): StoreOptions {
    const results: ResultRow[] = Array.from(
      { length: COMPANY_COUNT },
      (_value, index) =>
        accepted({
          index,
          domain: `company-${String(index).padStart(4, '0')}.test`,
          companyName: `Company ${String(index).padStart(4, '0')}`,
          emails: [
            { value: `info@company-${String(index).padStart(4, '0')}.test` },
            { value: `sales@company-${String(index).padStart(4, '0')}.test` },
          ],
        }),
    );

    return {
      runs: [
        { id: 'run-1', researchId: 'research-1', publishedAt: PUBLISHED_AT },
      ],
      results,
    };
  }

  it('pages through thousands of prepared companies without truncation', async () => {
    const { service } = serviceFor(manyCompaniesOptions());

    const first = await service.prepareRecipientQueue('research-1');
    expect(first.totals).toEqual({
      retainedCompanies: COMPANY_COUNT,
      preparedRecipients: COMPANY_COUNT,
      alternativeContacts: COMPANY_COUNT,
    });
    expect(first.totalItems).toBe(COMPANY_COUNT);
    expect(first.items).toHaveLength(DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE);

    const lastPage = Math.ceil(COMPANY_COUNT / DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE);
    const last = await service.getRecipientQueue(
      'research-1',
      queueOptions({ page: lastPage }),
    );
    expect(last.items).toHaveLength(
      COMPANY_COUNT - (lastPage - 1) * DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
    );
    expect(last.totalItems).toBe(COMPANY_COUNT);

    const beyond = await service.getRecipientQueue(
      'research-1',
      queueOptions({ page: lastPage + 1 }),
    );
    expect(beyond.items).toEqual([]);
    expect(beyond.totalItems).toBe(COMPANY_COUNT);
  });

  it('searches company name, domain and primary email case-insensitively', async () => {
    const { service } = serviceFor(manyCompaniesOptions());
    await service.prepareRecipientQueue('research-1');

    const byName = await service.getRecipientQueue(
      'research-1',
      queueOptions({ q: 'company 1999' }),
    );
    expect(byName.items.map((item) => item.domain)).toEqual([
      'company-1999.test',
    ]);
    expect(byName.totalItems).toBe(1);

    const byDomain = await service.getRecipientQueue(
      'research-1',
      queueOptions({ q: 'COMPANY-0042' }),
    );
    expect(byDomain.items.map((item) => item.domain)).toEqual([
      'company-0042.test',
    ]);

    const byEmail = await service.getRecipientQueue(
      'research-1',
      queueOptions({ q: 'sales@company-0500' }),
    );
    expect(byEmail.items.map((item) => item.primaryEmail)).toEqual([
      'sales@company-0500.test',
    ]);

    const none = await service.getRecipientQueue(
      'research-1',
      queueOptions({ q: 'no-such-company' }),
    );
    expect(none.items).toEqual([]);
    expect(none.totalItems).toBe(0);
    expect(none.totals.preparedRecipients).toBe(COMPANY_COUNT);
  });
});

describe('recipient queue query validation', () => {
  it('defaults page and page size', () => {
    expect(parseRecipientQueueQuery({})).toEqual({
      q: '',
      page: 1,
      pageSize: DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
    });
  });

  it('trims search text and accepts explicit pagination', () => {
    expect(
      parseRecipientQueueQuery({ q: '  alpha  ', page: '3', pageSize: '50' }),
    ).toEqual({ q: 'alpha', page: 3, pageSize: 50 });
  });

  it('rejects malformed, zero, negative and over-large values', () => {
    for (const input of [
      { page: '0' },
      { page: '-1' },
      { page: '1.5' },
      { page: 'abc' },
      { pageSize: '0' },
      { pageSize: '101' },
      { q: 'x'.repeat(201) },
    ]) {
      expect(() => parseRecipientQueueQuery(input)).toThrow(BadRequestException);
    }
  });
});
