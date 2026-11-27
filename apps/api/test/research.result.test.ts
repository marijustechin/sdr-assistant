import { describe, expect, it, vi } from 'vitest';

import { ResearchController } from '../src/modules/research/research.controller.js';
import { ResearchService } from '../src/modules/research/research.service.js';
import type { CreateResearchDto } from '../src/modules/research/dto/create-research.dto.js';
import type { CompanyProfile } from '../src/modules/research/stages/04-company-profiling/company-profiling.types.js';
import type { PageAssessmentResult } from '../src/modules/research/stages/03-page-assessment/page-assessment-result.js';
import type { PageAssessmentService } from '../src/modules/research/stages/03-page-assessment/page-assessment.service.js';
import type { PageCollectionService } from '../src/modules/research/stages/02-page-collection/page-collection.service.js';
import type { ProductIdentificationService } from '../src/modules/research/stages/01-product-identification/product-identification.service.js';
import type { CompanyProfilingService } from '../src/modules/research/stages/04-company-profiling/company-profiling.service.js';
import type { PrismaService } from '../src/modules/prisma/prisma.service.js';
import type { SettingsService } from '../src/modules/settings/settings.service.js';
import type { ContactDiscoveryAutomationService } from '../src/modules/contact-discovery-pipeline/contact-discovery.automation.js';

/**
 * Controlled synthetic stage-04 result. The aggregate shape the existing assertions
 * describe is preserved (25 profiles, 78 offers, 3 profiled / 22 needs_review, four
 * companies with a target-market offer, one named company with two target offers), but
 * the values are generated locally: no temp file, no real research payload and no
 * provider call is involved.
 */
const NAMED_DOMAIN = 'pirtiesprekes.lt';

function syntheticProfile(
  domain: string,
  status: 'profiled' | 'needs_review',
  offerCount: number,
  marketStatus: 'target' | 'unclear',
): CompanyProfile {
  return {
    domain,
    registrableDomain: domain,
    status,
    company: {
      name: `Synthetic company ${domain}`,
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [],
      phones: [],
      contactFormUrl: null,
      sources: [`https://${domain}/`],
    },
    offers: Array.from({ length: offerCount }, (_, index) => ({
      id: `03-${String(index + 1).padStart(4, '0')}`,
      item: `Synthetic item ${index + 1}`,
      verdict: index === 0 ? 'a' : 'b',
      traits: { synthetic_trait: index === 0 ? 'confirmed' : 'differs' },
      pageIds: [`03-${String(index + 1).padStart(4, '0')}`],
      sourceUrl: `https://${domain}/offer-${index + 1}`,
      marketFrom03: {
        status: marketStatus,
        note: null,
        sourceUrl: `https://${domain}/offer-${index + 1}`,
        quote: null,
      },
      market: {
        status: marketStatus,
        resolvedBy: 'none',
        basis: 'none',
        evidence: [],
        channels: { delivery: 'unknown', pickup: 'unknown', purchase: 'unknown' },
        conflict: false,
      },
      prices: [],
    })),
    usage: {
      llmCalls: 1,
      promptTokens: 10,
      completionTokens: 5,
      fetches: 0,
      fetchCredits: null,
      durationMs: 5,
    },
  };
}

/** 3 + 1 + 10 + 11 = 25 profiles; 3 + 2 + 40 + 33 = 78 offers. */
function buildDomains(): CompanyProfile[] {
  return [
    syntheticProfile('alpha.example', 'profiled', 1, 'target'),
    syntheticProfile('beta.example', 'profiled', 1, 'target'),
    syntheticProfile('gamma.example', 'profiled', 1, 'target'),
    syntheticProfile(NAMED_DOMAIN, 'needs_review', 2, 'target'),
    ...Array.from({ length: 10 }, (_, index) =>
      syntheticProfile(`synthetic-a-${index}.example`, 'needs_review', 4, 'unclear'),
    ),
    ...Array.from({ length: 11 }, (_, index) =>
      syntheticProfile(`synthetic-b-${index}.example`, 'needs_review', 3, 'unclear'),
    ),
  ];
}

/** Stands in for the stage-04 batch result the persistence boundary consumes. */
function buildSavedResult() {
  const domains = buildDomains();
  return {
    promptVersion: 'company-profiling-v1',
    createdAt: '2026-01-01T00:00:00.000Z',
    targetCountry: 'Lithuania',
    targetLanguage: 'Lithuanian',
    product: {
      productName: 'Synthetic product',
      categoryName: 'Synthetic category',
      generalCategoryName: 'Synthetic general',
      description: 'Synthetic description',
    },
    domains,
    diagnostics: [],
    summary: {
      domains: domains.length,
      reused: 0,
      firstCallOnly: domains.length,
      secondCall: 0,
      secondCallFailed: 0,
      errors: 0,
      newFetches: 0,
      newLlmCalls: domains.length,
      newPromptTokens: 0,
      newCompletionTokens: 0,
    },
  };
}

const PAGE = {
  url: 'https://alpha.example/offer-1',
  canonicalUrl: 'https://alpha.example/offer-1',
  domain: 'alpha.example',
  title: 'Synthetic page',
  highlights: [],
  snippets: [],
  summary: null,
  content: 'Synthetic page text',
};

const ASSESSMENT: PageAssessmentResult = {
  targetCountry: 'Lithuania',
  targetLanguage: 'Lithuanian',
  product: {
    productName: 'Synthetic product',
    categoryName: 'Synthetic category',
    generalCategoryName: 'Synthetic general',
    description: 'Synthetic description',
  },
  domains: [],
};

type JobRow = {
  id: string;
  status: string;
  stage?: string | null;
  result?: unknown;
  error?: string | null;
  executionToken?: string | null;
  executionLeaseUntil?: Date | null;
  [key: string]: unknown;
};

type Harness = {
  service: ResearchService;
  controller: ResearchController;
  rows: Map<string, JobRow>;
  researchCompletion: ReturnType<typeof vi.fn>;
  profile: ReturnType<typeof vi.fn>;
  completed: Promise<JobRow>;
  failed: Promise<JobRow>;
};

function makeHarness(
  savedResult: unknown = buildSavedResult(),
  contactDiscoveryAutomation?: ContactDiscoveryAutomationService,
  profiling: () => Promise<unknown> = async () => savedResult,
): Harness {
  const rows = new Map<string, JobRow>();
  let resolveCompleted: (row: JobRow) => void = () => {};
  const completed = new Promise<JobRow>((resolve) => {
    resolveCompleted = resolve;
  });
  let resolveFailed: (row: JobRow) => void = () => {};
  const failed = new Promise<JobRow>((resolve) => {
    resolveFailed = resolve;
  });

  const research = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return rows.get(where.id) ?? null;
    }),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row: JobRow = {
        id: 'job-1',
        status: 'QUEUED',
        stage: null,
        result: null,
        error: null,
        executionToken: null,
        executionLeaseUntil: null,
        ...data,
      };
      rows.set(row.id, row);
      return { id: row.id, status: row.status };
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<JobRow> }) => {
        const current = rows.get(where.id) ?? { id: where.id, status: 'QUEUED' };
        const next: JobRow = { ...current, ...data };
        rows.set(where.id, next);
        return next;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<JobRow> & { result?: unknown };
      }) => {
        // `failStaleRuns` sweeps by status, never by id.
        if (typeof where.id !== 'string') return { count: 0 };

        const current = rows.get(where.id);
        if (!current) return { count: 0 };

        // The terminal writes are conditional on the caller still owning the run.
        if (
          'executionToken' in where &&
          current.executionToken !== where.executionToken
        ) {
          return { count: 0 };
        }

        const next: JobRow = { ...current, ...data };
        if (data.result !== undefined) {
          // Mirror Prisma's JSON round-trip: no undefined values survive.
          next.result = JSON.parse(JSON.stringify(data.result));
        }
        rows.set(where.id, next);
        if (data.status === 'COMPLETED') resolveCompleted(next);
        if (data.status === 'FAILED') resolveFailed(next);
        return { count: 1 };
      },
    ),
  };

  const prisma = {
    research,
    product: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
    },
  } as unknown as PrismaService;

  const identify = vi.fn(async () => ({
    product: {
      productName: 'Synthetic product',
      categoryName: 'Synthetic category',
      generalCategoryName: 'Synthetic general',
    },
    sourcePages: [PAGE],
  }));
  const collect = vi.fn(async () => [PAGE]);
  const assessPages = vi.fn(async () => ASSESSMENT);
  const profile = vi.fn(profiling);

  const service = new ResearchService(
    { identify } as unknown as ProductIdentificationService,
    { collect } as unknown as PageCollectionService,
    { assessPages } as unknown as PageAssessmentService,
    { profile } as unknown as CompanyProfilingService,
    prisma,
    { getNumber: vi.fn(async () => 5) } as unknown as SettingsService,
    contactDiscoveryAutomation,
  );

  return {
    service,
    controller: new ResearchController(service),
    rows,
    researchCompletion: research.updateMany,
    profile,
    completed,
    failed,
  };
}

describe('Research result persistence', () => {
  it('returns all 25 04 profiles and 78 offers through the API after COMPLETED', async () => {
    const saved = buildSavedResult();
    const harness = makeHarness(saved);
    const dto: CreateResearchDto = {
      name: 'Synthetic product',
      description: 'Synthetic description',
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

    // Corrected by SDR-006A: the normal completion path now persists the stage-04 result
    // under the shared versioned contract instead of the retired `04-company-discovery` label.
    expect(result.completedThrough).toBe('04-company-profiling');
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

    const named = companies.find(
      (company) => (company as unknown as { domain: string }).domain === NAMED_DOMAIN,
    );
    expect(named?.status).toBe('needs_review');
    expect(named?.offers).toHaveLength(2);
    expect(named?.offers.every((offer) => offer.market.status === 'target')).toBe(true);

    expect(completedRow.status).toBe('COMPLETED');
    expect(completedRow.stage).toBe('05-contact-discovery-pending');
    expect(returned.stage).toBeNull();
    expect(
      harness.researchCompletion.mock.calls.filter(
        (call) =>
          (call[0] as { data?: { status?: string } }).data?.status === 'COMPLETED',
      ),
    ).toHaveLength(1);
    // Corrected by SDR-006A: the completion write is now the token-guarded conditional
    // write (`updateMany`), not the unconditional `update` the older harness expected.
    expect(harness.researchCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'job-1' }),
        data: expect.objectContaining({
          status: 'COMPLETED',
          result: expect.objectContaining({
            companies: saved.domains,
          }),
        }),
      }),
    );
  });

  it('starts Stage 05 after a successful Stage 04 completion', async () => {
    const afterStage04Completed = vi.fn(async () => undefined);
    const harness = makeHarness(buildSavedResult(), {
      afterStage04Completed,
    } as unknown as ContactDiscoveryAutomationService);
    const dto: CreateResearchDto = {
      name: 'Synthetic product',
      description: 'Synthetic description',
      country: 'Lithuania',
      productId: 'product-1',
    };

    await harness.service.start(dto);
    await harness.completed;
    await vi.waitFor(() =>
      expect(afterStage04Completed).toHaveBeenCalledTimes(1),
    );
    expect(afterStage04Completed).toHaveBeenCalledWith('job-1');
  });

  it('does not start Stage 05 when Stage 04 fails', async () => {
    const afterStage04Completed = vi.fn(async () => undefined);
    const harness = makeHarness(
      buildSavedResult(),
      { afterStage04Completed } as unknown as ContactDiscoveryAutomationService,
      async () => {
        throw new Error('stage 04 failed');
      },
    );
    const dto: CreateResearchDto = {
      name: 'Synthetic product',
      description: 'Synthetic description',
      country: 'Lithuania',
      productId: 'product-1',
    };

    await harness.service.start(dto);
    await harness.failed;
    await vi.waitFor(() => expect(harness.profile).toHaveBeenCalledTimes(1));
    expect(afterStage04Completed).not.toHaveBeenCalled();
    expect(harness.rows.get('job-1')?.stage).toBeNull();
  });

  it('keeps Stage 04 COMPLETED when Stage 05 startup fails', async () => {
    const afterStage04Completed = vi.fn(async () => {
      throw new Error('stage 05 failed');
    });
    const harness = makeHarness(buildSavedResult(), {
      afterStage04Completed,
    } as unknown as ContactDiscoveryAutomationService);
    const dto: CreateResearchDto = {
      name: 'Synthetic product',
      description: 'Synthetic description',
      country: 'Lithuania',
      productId: 'product-1',
    };

    await harness.service.start(dto);
    const completed = await harness.completed;
    await vi.waitFor(() =>
      expect(afterStage04Completed).toHaveBeenCalledTimes(1),
    );
    expect(completed.status).toBe('COMPLETED');
    expect(harness.rows.get('job-1')?.status).toBe('COMPLETED');
  });
  it('keeps legacy results without companies readable', async () => {
    const harness = makeHarness();
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
