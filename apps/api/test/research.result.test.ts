import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { ResearchController } from '../src/modules/research/research.controller';
import { ResearchService } from '../src/modules/research/research.service';
import type { CreateResearchDto } from '../src/modules/research/dto/create-research.dto';

type JobRow = {
  id: string;
  status: string;
  stage?: string | null;
  result?: unknown;
  error?: string | null;
};

type Harness = {
  service: ResearchService;
  controller: ResearchController;
  rows: Map<string, JobRow>;
  researchUpdate: ReturnType<typeof vi.fn>;
  profile: ReturnType<typeof vi.fn>;
  completed: Promise<JobRow>;
};

async function loadSavedResult(): Promise<{
  domains: unknown[];
  [key: string]: unknown;
}> {
  return JSON.parse(
    await readFile(
      'src/modules/research/temp/04-profiling-result-dailylen-2026-11-23-23-21-53.json',
      'utf8',
    ),
  ) as { domains: unknown[]; [key: string]: unknown };
}

function makeHarness(savedResult: unknown): Harness {
  const rows = new Map<string, JobRow>();
  let resolveCompleted: (row: JobRow) => void = () => {};
  const completed = new Promise<JobRow>((resolve) => {
    resolveCompleted = resolve;
  });

  const research = {
    updateMany: vi.fn(async () => ({ count: 0 })),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return rows.get(where.id) ?? null;
    }),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row: JobRow = {
        id: 'job-1',
        status: 'QUEUED',
        result: null,
        ...data,
      };
      rows.set(row.id, row);
      return { id: row.id, status: row.status };
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<JobRow> & { result?: unknown };
      }) => {
        const current = rows.get(where.id) ?? { id: where.id, status: 'QUEUED' };
        const next: JobRow = { ...current, ...data };
        if (data.result !== undefined) {
          // Mirror Prisma's JSON round-trip: no undefined values survive.
          next.result = JSON.parse(JSON.stringify(data.result));
        }
        rows.set(where.id, next);
        if (data.status === 'COMPLETED') resolveCompleted(next);
        return next;
      },
    ),
  };

  const prisma = {
    research,
    product: {
      findUnique: vi.fn(async () => ({ id: 'product-1' })),
    },
  } as unknown as ConstructorParameters<typeof ResearchService>[4];

  const profile = vi.fn(async () => savedResult);
  const companyProfiling = {
    profile,
  } as unknown as ConstructorParameters<typeof ResearchService>[3];

  const service = new ResearchService(
    {} as ConstructorParameters<typeof ResearchService>[0],
    {} as ConstructorParameters<typeof ResearchService>[1],
    {} as ConstructorParameters<typeof ResearchService>[2],
    companyProfiling,
    prisma,
    {
      getNumber: vi.fn(async () => 5),
    } as unknown as ConstructorParameters<typeof ResearchService>[5],
  );

  return {
    service,
    controller: new ResearchController(service),
    rows,
    researchUpdate: research.update,
    profile,
    completed,
  };
}

describe('Research result persistence', () => {
  it('returns all 25 04 profiles and 78 offers through the API after COMPLETED', async () => {
    const saved = await loadSavedResult();
    const harness = makeHarness(saved);
    const dto: CreateResearchDto = {
      name: 'Termo abachi dailylentė',
      description: 'Thermally modified Abachi cladding.',
      country: 'Lithuania',
      productId: 'product-1',
    };

    const started = await harness.service.start(dto);

    expect(started).toEqual({ jobId: 'job-1', status: 'QUEUED' });

    const completedRow = await harness.completed;
    expect(harness.profile).toHaveBeenCalledTimes(1);
    const returned = await harness.controller.getById(started.jobId);
    const result = returned.result as {
      completedThrough: string;
      resultsPerQuery: number;
      companies: unknown[];
    };

    expect(result.completedThrough).toBe('04-company-discovery');
    expect(result.resultsPerQuery).toBe(5);
    expect(result.companies).toEqual(saved.domains);
    expect(result.companies).toHaveLength(25);

    const companies = result.companies as Array<{
      status: string;
      offers: Array<{ market: { status: string } }>;
    }>;
    const offers = companies.flatMap((company) => company.offers);
    const statuses = companies.reduce<Record<string, number>>((counts, company) => {
      counts[company.status] = (counts[company.status] ?? 0) + 1;
      return counts;
    }, {});

    expect(offers).toHaveLength(78);
    expect(statuses).toEqual({ profiled: 3, needs_review: 22 });
    expect(
      companies.filter((company) =>
        company.offers.some((offer) => offer.market.status === 'target'),
      ),
    ).toHaveLength(4);

    const pirtiesprekes = companies.find(
      (company) =>
        (company as unknown as { domain: string }).domain === 'pirtiesprekes.lt',
    );
    expect(pirtiesprekes?.status).toBe('needs_review');
    expect(pirtiesprekes?.offers).toHaveLength(2);
    expect(
      pirtiesprekes?.offers.every(
        (offer) => offer.market.status === 'target',
      ),
    ).toBe(true);

    expect(completedRow.status).toBe('COMPLETED');
    expect(
      harness.researchUpdate.mock.calls.filter(
        (call) =>
          (call[0] as { data?: { status?: string } }).data?.status ===
          'COMPLETED',
      ),
    ).toHaveLength(1);
    expect(harness.researchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          result: expect.objectContaining({
            companies: saved.domains,
          }),
        }),
      }),
    );
  });

  it('keeps legacy results without companies readable', async () => {
    const harness = makeHarness({ domains: [] });
    harness.rows.set('legacy-job', {
      id: 'legacy-job',
      status: 'COMPLETED',
      result: {
        completedThrough: '02-page-collection',
        resultsPerQuery: 5,
      },
    });

    const legacy = await harness.controller.getById('legacy-job');

    expect(legacy.result).toEqual({
      completedThrough: '02-page-collection',
      resultsPerQuery: 5,
    });
  });
});
