import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ATTACHMENT_MAX_ATTACHMENTS_ENV,
  ATTACHMENT_MAX_FILE_BYTES_ENV,
  ATTACHMENT_MAX_TOTAL_BYTES_ENV,
  DEFAULT_ATTACHMENT_LIMITS,
  readAttachmentLimits,
} from '../src/modules/research-communication/attachment-limits';
import {
  ResearchAttachmentsService,
  type ResearchAttachmentUpload,
} from '../src/modules/research-communication/research-attachments.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Synthetic, in-memory Prisma stand-in. No database, filesystem, SMTP or IMAP
 * connection is involved and every fixture is invented test data.
 */
type AttachmentRow = {
  id: string;
  researchId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  content: Uint8Array;
  createdAt: Date;
  updatedAt: Date;
};

function createStore(researches: readonly string[] = ['research-1']) {
  const knownResearches = new Set(researches);
  const rows = new Map<string, AttachmentRow>();
  let sequence = 0;

  const prisma = {
    research: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        knownResearches.has(where.id) ? { id: where.id } : null,
    },
    researchAttachment: {
      findMany: async ({ where }: { where: { researchId: string } }) =>
        [...rows.values()]
          .filter((row) => row.researchId === where.researchId)
          .sort(
            (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
          ),
      count: async ({ where }: { where: { researchId: string } }) =>
        [...rows.values()].filter((row) => row.researchId === where.researchId)
          .length,
      aggregate: async ({ where }: { where: { researchId: string } }) => ({
        _sum: {
          sizeBytes: [...rows.values()]
            .filter((row) => row.researchId === where.researchId)
            .reduce((total, row) => total + row.sizeBytes, 0),
        },
      }),
      create: async ({
        data,
      }: {
        data: {
          researchId: string;
          filename: string;
          mimeType: string;
          sizeBytes: number;
          sha256: string;
          content: Uint8Array;
        };
      }) => {
        sequence += 1;
        const now = new Date(Date.UTC(2026, 10, 27, 12, sequence));
        const row: AttachmentRow = {
          id: `attachment-${sequence}`,
          ...data,
          createdAt: now,
          updatedAt: now,
        };

        rows.set(row.id, row);

        return row;
      },
      findFirst: async ({
        where,
      }: {
        where: { id: string; researchId: string };
      }) => {
        const row = rows.get(where.id);

        return row !== undefined && row.researchId === where.researchId
          ? { id: row.id }
          : null;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = rows.get(where.id);

        if (row === undefined) {
          throw new Error(`No attachment ${where.id}`);
        }

        rows.delete(where.id);

        return row;
      },
    },
    $transaction: async <T>(
      callback: (transaction: unknown) => Promise<T>,
    ): Promise<T> => callback(prisma),
  };

  return {
    prisma: prisma as unknown as PrismaService,
    rows,
    service: new ResearchAttachmentsService(prisma as unknown as PrismaService),
  };
}

function upload(
  overrides: Partial<ResearchAttachmentUpload> = {},
): ResearchAttachmentUpload {
  return {
    filename: 'price-list.pdf',
    mimeType: 'application/pdf',
    content: Buffer.from('synthetic attachment content', 'utf8'),
    ...overrides,
  };
}

const ENV_KEYS = [
  ATTACHMENT_MAX_FILE_BYTES_ENV,
  ATTACHMENT_MAX_ATTACHMENTS_ENV,
  ATTACHMENT_MAX_TOTAL_BYTES_ENV,
] as const;

const previousEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = previousEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('attachment limits', () => {
  it('uses the documented defaults when nothing is configured', () => {
    expect(readAttachmentLimits({})).toEqual(DEFAULT_ATTACHMENT_LIMITS);
  });

  it('reads configured positive integers', () => {
    expect(
      readAttachmentLimits({
        [ATTACHMENT_MAX_FILE_BYTES_ENV]: '2048',
        [ATTACHMENT_MAX_ATTACHMENTS_ENV]: '2',
        [ATTACHMENT_MAX_TOTAL_BYTES_ENV]: '4096',
      }),
    ).toEqual({
      maxFileBytes: 2048,
      maxAttachments: 2,
      maxTotalBytes: 4096,
    });
  });

  it('falls back for malformed, zero or out-of-range values', () => {
    expect(
      readAttachmentLimits({
        [ATTACHMENT_MAX_FILE_BYTES_ENV]: 'not-a-number',
        [ATTACHMENT_MAX_ATTACHMENTS_ENV]: '0',
        [ATTACHMENT_MAX_TOTAL_BYTES_ENV]: '999999999999',
      }),
    ).toEqual(DEFAULT_ATTACHMENT_LIMITS);
  });

  it('never lets the total limit be smaller than one accepted file', () => {
    expect(
      readAttachmentLimits({
        [ATTACHMENT_MAX_FILE_BYTES_ENV]: '4096',
        [ATTACHMENT_MAX_TOTAL_BYTES_ENV]: '1024',
      }).maxTotalBytes,
    ).toBe(4096);
  });
});

describe('research attachment listing', () => {
  it('returns an empty list and the active limits', async () => {
    const { service } = createStore();

    await expect(service.list('research-1')).resolves.toEqual({
      limits: DEFAULT_ATTACHMENT_LIMITS,
      items: [],
    });
  });

  it('returns metadata only, ordered by creation, never the file bytes', async () => {
    const { service, rows } = createStore();

    const first = await service.upload('research-1', upload());
    const second = await service.upload(
      'research-1',
      upload({
        filename: 'company-profile.png',
        mimeType: 'image/png',
        content: Buffer.from('different synthetic bytes', 'utf8'),
      }),
    );

    const listed = await service.list('research-1');

    expect(listed.items.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(listed.items[0]).toEqual({
      id: first.id,
      filename: 'price-list.pdf',
      mimeType: 'application/pdf',
      sizeBytes: Buffer.byteLength('synthetic attachment content'),
      sha256: first.sha256,
      createdAt: first.createdAt,
    });

    const serialized = JSON.stringify(listed);
    expect(serialized).not.toContain('synthetic attachment content');
    expect(serialized).not.toContain('different synthetic bytes');
    expect(Object.keys(listed.items[0] ?? {})).not.toContain('content');
    expect(rows.size).toBe(2);
  });

  it('rejects an unknown research', async () => {
    const { service } = createStore();

    await expect(service.list('missing')).rejects.toThrow(/not found/);
    await expect(
      service.upload('missing', upload()),
    ).rejects.toThrow(/not found/);
    await expect(
      service.remove('missing', 'attachment-1'),
    ).rejects.toThrow(/not found/);
  });
});

describe('research attachment upload', () => {
  it('stores the bytes, size and SHA-256 and returns metadata only', async () => {
    const { service, rows } = createStore();
    const content = Buffer.from('synthetic attachment content', 'utf8');

    const created = await service.upload('research-1', upload({ content }));
    const stored = rows.get(created.id);

    expect(stored?.content).toBeDefined();
    expect(
      Buffer.from(stored?.content ?? []).equals(content),
    ).toBe(true);
    expect(stored?.sizeBytes).toBe(content.length);
    expect(stored?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(created.sha256).toBe(stored?.sha256);
    expect(JSON.stringify(created)).not.toContain('synthetic attachment content');
  });

  it('normalises an unusable media type to a generic binary type', async () => {
    const { service } = createStore();

    await expect(
      service.upload('research-1', upload({ mimeType: 'not a media type' })),
    ).resolves.toMatchObject({ mimeType: 'application/octet-stream' });

    await expect(
      service.upload('research-1', upload({ mimeType: 'IMAGE/PNG' })),
    ).resolves.toMatchObject({ mimeType: 'image/png' });

    await expect(
      service.upload('research-1', upload({ mimeType: undefined })),
    ).resolves.toMatchObject({ mimeType: 'application/octet-stream' });
  });

  it('reads an uploaded attachment through a fresh service instance', async () => {
    const { prisma, service } = createStore();

    const created = await service.upload('research-1', upload());

    // A new service holds no in-memory state: it reads the persisted row, which
    // is the application-restart path once the bytes live in PostgreSQL.
    const restarted = new ResearchAttachmentsService(prisma);
    const listed = await restarted.list('research-1');

    expect(listed.items).toEqual([
      expect.objectContaining({
        id: created.id,
        filename: 'price-list.pdf',
        sizeBytes: Buffer.byteLength('synthetic attachment content'),
      }),
    ]);
    expect(JSON.stringify(listed)).not.toContain(
      'synthetic attachment content',
    );
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['../secret.txt', 'invalid'],
    ['folder/file.pdf', 'invalid'],
    ['folder\\file.pdf', 'invalid'],
    ['.', 'invalid'],
    ['..', 'invalid'],
    ['line\nbreak.pdf', 'invalid'],
    ['x'.repeat(201), 'at most'],
  ])('rejects the unsafe file name %j', async (filename, message) => {
    const { service, rows } = createStore();

    await expect(
      service.upload('research-1', upload({ filename })),
    ).rejects.toThrow(message);
    expect(rows.size).toBe(0);
  });

  it('rejects an empty body or a non-binary transport value', async () => {
    const { service, rows } = createStore();

    await expect(
      service.upload('research-1', upload({ content: Buffer.alloc(0) })),
    ).rejects.toThrow(/empty/);
    await expect(
      service.upload('research-1', upload({ content: 'not binary' })),
    ).rejects.toThrow(/binary/);
    await expect(
      service.upload('research-1', upload({ content: { text: 'json' } })),
    ).rejects.toThrow(/binary/);
    expect(rows.size).toBe(0);
  });

  it('enforces the configured per-file limit', async () => {
    process.env[ATTACHMENT_MAX_FILE_BYTES_ENV] = '8';
    process.env[ATTACHMENT_MAX_TOTAL_BYTES_ENV] = '64';

    const { service, rows } = createStore();

    await expect(
      service.upload('research-1', upload({ content: Buffer.alloc(9) })),
    ).rejects.toThrow(/at most 8 B/);
    await expect(
      service.upload('research-1', upload({ content: Buffer.alloc(8) })),
    ).resolves.toMatchObject({ sizeBytes: 8 });
    expect(rows.size).toBe(1);
  });

  it('enforces the configured attachment count', async () => {
    process.env[ATTACHMENT_MAX_ATTACHMENTS_ENV] = '2';

    const { service, rows } = createStore();

    await service.upload('research-1', upload());
    await service.upload('research-1', upload({ filename: 'second.pdf' }));

    await expect(
      service.upload('research-1', upload({ filename: 'third.pdf' })),
    ).rejects.toThrow(/at most 2 attachments/);
    expect(rows.size).toBe(2);
  });

  it('enforces the configured total size limit', async () => {
    process.env[ATTACHMENT_MAX_FILE_BYTES_ENV] = '8';
    process.env[ATTACHMENT_MAX_TOTAL_BYTES_ENV] = '12';

    const { service, rows } = createStore();

    await service.upload('research-1', upload({ content: Buffer.alloc(8) }));

    await expect(
      service.upload('research-1', upload({ content: Buffer.alloc(8) })),
    ).rejects.toThrow(/must total at most 12 B/);
    expect(rows.size).toBe(1);
  });

  it('keeps the limits isolated per research', async () => {
    process.env[ATTACHMENT_MAX_ATTACHMENTS_ENV] = '1';

    const { service, rows } = createStore(['research-1', 'research-2']);

    await service.upload('research-1', upload());
    await expect(
      service.upload('research-2', upload()),
    ).resolves.toMatchObject({ filename: 'price-list.pdf' });
    expect(rows.size).toBe(2);
  });
});

describe('research attachment removal', () => {
  it('removes one attachment and keeps the others', async () => {
    const { service, rows } = createStore();

    const first = await service.upload('research-1', upload());
    const second = await service.upload(
      'research-1',
      upload({ filename: 'second.pdf' }),
    );

    await service.remove('research-1', first.id);

    expect(rows.has(first.id)).toBe(false);
    expect(rows.has(second.id)).toBe(true);
    await expect(service.list('research-1')).resolves.toMatchObject({
      items: [{ id: second.id }],
    });
  });

  it('does not remove an attachment owned by another research', async () => {
    const { service, rows } = createStore(['research-1', 'research-2']);
    const created = await service.upload('research-1', upload());

    await expect(
      service.remove('research-2', created.id),
    ).rejects.toThrow(/not found/);
    expect(rows.has(created.id)).toBe(true);
  });

  it('rejects an unknown attachment id', async () => {
    const { service } = createStore();

    await expect(
      service.remove('research-1', 'missing-attachment'),
    ).rejects.toThrow(/not found/);
  });
});
