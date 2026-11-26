import { describe, expect, it, vi } from 'vitest';

import { ResearchController } from '../src/modules/research/research.controller.js';
import { ResearchService } from '../src/modules/research/research.service.js';
import { prepareHistoricalResultRecovery, targetRecoveryFingerprint } from '../src/modules/research/final-result.js';
import type { CompanyProfile } from '../src/modules/research/stages/04-company-profiling/company-profiling.types.js';
import type { PageAssessmentResult } from '../src/modules/research/stages/03-page-assessment/page-assessment-result.js';
import type { PageAssessmentService } from '../src/modules/research/stages/03-page-assessment/page-assessment.service.js';
import type { PageCollectionService } from '../src/modules/research/stages/02-page-collection/page-collection.service.js';
import type { ProductIdentificationService } from '../src/modules/research/stages/01-product-identification/product-identification.service.js';
import type { CompanyProfilingService } from '../src/modules/research/stages/04-company-profiling/company-profiling.service.js';
import type { PrismaService } from '../src/modules/prisma/prisma.service.js';
import type { SettingsService } from '../src/modules/settings/settings.service.js';
import type { CreateResearchDto } from '../src/modules/research/dto/create-research.dto.js';

/**
 * Synthetic stage-04 output. Shaped exactly like a real CompanyProfile, but every
 * value is invented and every domain uses the reserved `.example` TLD.
 */
function profile(domain: string, index: number): CompanyProfile {
  return {
    domain,
    registrableDomain: domain,
    status: index === 0 ? 'profiled' : 'needs_review',
    company: {
      name: index === 0 ? null : `Synthetic company ${index}`,
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [
        {
          value: `sales@${domain}`,
          label: 'sales',
          sourceUrl: `https://${domain}/contact`,
        },
      ],
      phones: [
        {
          value: '+00000000000',
          normalised: null,
          label: null,
          sourceUrl: `https://${domain}/contact`,
        },
      ],
      contactFormUrl: null,
      sources: [`https://${domain}/`, `https://${domain}/contact`],
    },
    offers: [
      {
        id: `03-${String(index + 1).padStart(4, '0')}`,
        item: `Synthetic item ${index}`,
        verdict: index === 0 ? 'a' : 'b',
        // Deliberately not a fixed trait name: research runs use study-specific keys.
        traits: { study_specific_trait: index === 0 ? 'confirmed' : 'differs' },
        pageIds: [`03-${String(index + 1).padStart(4, '0')}`],
        sourceUrl: `https://${domain}/offer`,
        marketFrom03: {
          status: index === 0 ? 'target' : 'unclear',
          note: null,
          sourceUrl: `https://${domain}/offer`,
          quote: index === 0 ? 'Synthetic quoted evidence' : null,
        },
        market: {
          status: index === 0 ? 'target' : 'unclear',
          resolvedBy: 'none',
          basis: 'none',
          evidence: [],
          channels: { delivery: 'unknown', pickup: 'unknown', purchase: 'unknown' },
          conflict: false,
        },
        prices:
          index === 1
            ? [
                {
                  amount: 12.5,
                  currency: 'EUR',
                  unit: 'm2',
                  vatIncluded: null,
                  priceType: 'from',
                  variant: null,
                  quote: 'Synthetic price quote',
                  sourceUrl: `https://${domain}/offer`,
                },
              ]
            : [],
      },
    ],
    usage: {
      llmCalls: 2,
      promptTokens: 100,
      completionTokens: 40,
      fetches: 1,
      fetchCredits: null,
      durationMs: 25,
    },
  };
}

const SYNTHETIC_PROFILES: CompanyProfile[] = [
  profile('alpha.example', 0),
  profile('beta.example', 1),
];

const SYNTHETIC_SUMMARY = {
  domains: 2,
  reused: 0,
  firstCallOnly: 2,
  secondCall: 0,
  secondCallFailed: 0,
  errors: 0,
  newFetches: 2,
  newLlmCalls: 2,
  newPromptTokens: 150,
  newCompletionTokens: 60,
};

function profilingResult(domains: CompanyProfile[] = SYNTHETIC_PROFILES) {
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
    summary: SYNTHETIC_SUMMARY,
  };
}

const PAGE = {
  url: 'https://alpha.example/offer',
  canonicalUrl: 'https://alpha.example/offer',
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

const DTO: CreateResearchDto = {
  name: 'Synthetic product',
  description: 'Synthetic description',
  country: 'Lithuania',
  productId: 'product-1',
};

type Row = Record<string, unknown> & { id: string; status: string };

function queuedRow(): Row {
  return {
    id: 'job-1',
    productId: 'product-1',
    country: 'Lithuania',
    status: 'QUEUED',
    stage: null,
    result: null,
    error: null,
    lastHeartbeatAt: null,
    executionToken: null,
    executionLeaseUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

type CompletionMode = 'write' | 'throw' | 'lose-lease';

/**
 * Minimal Prisma double that mirrors the real semantics the service depends on:
 * a conditional write matches only while the caller still owns the execution token,
 * and a JSON result round-trips exactly as Prisma's JSON column does.
 */
function makePrisma(initialRow: Row, mode: CompletionMode = 'write') {
  let row = initialRow;
  let completionAttempts = 0;
  let applyOnCompletion = mode === 'write';

  const research = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      row && row.id === where.id ? row : null,
    ),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      row = { ...queuedRow(), ...data };
      return { id: row.id, status: row.status };
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      row = { ...row, ...data };
      return row;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        // `failStaleRuns` sweeps by status, never by id.
        if (typeof where.id !== 'string') return { count: 0 };

        // The claim inside resume() filters by status + lease, not by token.
        if (!('executionToken' in where)) {
          row = { ...row, ...data };
          return { count: 1 };
        }

        if (data.status === 'COMPLETED') completionAttempts += 1;

        // The ownership filter is evaluated by the database before any write.
        if (row.executionToken !== where.executionToken) return { count: 0 };

        if (data.status === 'COMPLETED') {
          if (mode === 'throw') throw new Error('simulated persistence failure');
          if (!applyOnCompletion) return { count: 0 };
          row = { ...row, ...data, result: JSON.parse(JSON.stringify(data.result)) };
          return { count: 1 };
        }

        row = { ...row, ...data };
        return { count: 1 };
      },
    ),
  };

  const product = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: 'Synthetic product',
      description: 'Synthetic description',
    })),
  };

  return {
    prisma: { research, product } as unknown as PrismaService,
    research,
    get row() {
      return row;
    },
    get completionAttempts() {
      return completionAttempts;
    },
    setRow(next: Row) {
      row = next;
    },
    /** Simulates the lease being taken by another executor between read and write. */
    stealLease() {
      row = { ...row, executionToken: 'other-execution-token' };
      applyOnCompletion = false;
    },
  };
}

function makeService(input: {
  prisma: PrismaService;
  profiling?: () => Promise<unknown>;
  collect?: () => Promise<unknown>;
}) {
  const identify = vi.fn(
    async (
      _dto: CreateResearchDto,
      _language: string,
      _jobId: string,
      onStage?: (stage: string) => Promise<void>,
    ) => {
      await onStage?.('1.1 Synthetic identification');
      return {
        product: {
          productName: 'Synthetic product',
          categoryName: 'Synthetic category',
          generalCategoryName: 'Synthetic general',
        },
        sourcePages: [PAGE],
      };
    },
  );
  const collect = vi.fn(input.collect ?? (async () => [PAGE]));
  const assessPages = vi.fn(async () => ASSESSMENT);
  const profile = vi.fn(input.profiling ?? (async () => profilingResult()));

  const service = new ResearchService(
    { identify } as unknown as ProductIdentificationService,
    { collect } as unknown as PageCollectionService,
    { assessPages } as unknown as PageAssessmentService,
    { profile } as unknown as CompanyProfilingService,
    input.prisma,
    { getNumber: vi.fn(async () => 40) } as unknown as SettingsService,
  );

  return { service, identify, collect, assessPages, profile };
}

async function runToTerminal(
  service: ResearchService,
  prismaMock: ReturnType<typeof makePrisma>,
  status: 'COMPLETED' | 'FAILED',
) {
  await service.start(DTO);
  await vi.waitFor(() => expect(prismaMock.row.status).toBe(status));
}

describe('final research result persistence', () => {
  it('persists the complete stage-04 company profiles on the normal completion path', async () => {
    const prisma = makePrisma(queuedRow());
    const harness = makeService({ prisma: prisma.prisma });

    await runToTerminal(harness.service, prisma, 'COMPLETED');

    const result = prisma.row.result as Record<string, unknown>;

    expect(result.schemaVersion).toBe(1);
    expect(result.completedThrough).toBe('04-company-profiling');
    expect(result.companies).toEqual(SYNTHETIC_PROFILES);
    expect(result.companies).toHaveLength(2);
    expect(result.summary).toEqual(SYNTHETIC_SUMMARY);
    expect(result.resultsPerQuery).toBe(40);
    expect(prisma.row.status).toBe('COMPLETED');
    expect(prisma.row.stage).toBeNull();
    expect(prisma.row.executionToken).toBeNull();
    expect(prisma.row.executionLeaseUntil).toBeNull();
    expect(harness.profile).toHaveBeenCalledTimes(1);
  });

  it('preserves every nested profile field without reclassification or filtering', async () => {
    const prisma = makePrisma(queuedRow());
    const harness = makeService({ prisma: prisma.prisma });

    await runToTerminal(harness.service, prisma, 'COMPLETED');

    const companies = (prisma.row.result as { companies: CompanyProfile[] }).companies;
    const [first, second] = companies;

    expect(companies.map((company) => company.status)).toEqual([
      'profiled',
      'needs_review',
    ]);
    expect(first.company.emails[0]?.sourceUrl).toBe('https://alpha.example/contact');
    expect(first.company.phones[0]?.value).toBe('+00000000000');
    expect(first.offers[0]?.verdict).toBe('a');
    expect(first.offers[0]?.traits).toEqual({ study_specific_trait: 'confirmed' });
    expect(first.offers[0]?.marketFrom03.quote).toBe('Synthetic quoted evidence');
    expect(second.offers[0]?.prices).toHaveLength(1);
    expect(second.offers[0]?.prices[0]?.currency).toBe('EUR');
    expect(second.company.name).toBe('Synthetic company 1');
    expect(companies).toEqual(SYNTHETIC_PROFILES);
  });

  it('persists the same versioned contract on the resumed completion path', async () => {
    const resumeRow: Row = {
      ...queuedRow(),
      id: 'job-resume',
      status: 'INTERRUPTED',
      product: {
        id: 'product-1',
        name: 'Synthetic product',
        description: 'Synthetic description',
      },
      stage01Result: {
        identifiedProduct: {
          productName: 'Synthetic product',
          categoryName: 'Synthetic category',
          generalCategoryName: 'Synthetic general',
        },
        preparedCandidates: [],
      },
      stage02Result: { result: [PAGE] },
      stage03Result: {
        criteria: { language: 'lt', traits: [] },
        promptVersion: 'page-assessment-v5',
      },
    };
    const prisma = makePrisma(resumeRow);

    const resumePages = vi.fn(async () => ASSESSMENT);
    const profile = vi.fn(async () => profilingResult());
    const service = new ResearchService(
      {} as ProductIdentificationService,
      {} as PageCollectionService,
      { resumePages } as unknown as PageAssessmentService,
      { profile } as unknown as CompanyProfilingService,
      prisma.prisma,
      {} as SettingsService,
    );

    await service.resume('job-resume');
    await vi.waitFor(() => expect(prisma.row.status).toBe('COMPLETED'));

    const result = prisma.row.result as Record<string, unknown>;

    expect(result.schemaVersion).toBe(1);
    expect(result.completedThrough).toBe('04-company-profiling');
    expect(result.companies).toEqual(SYNTHETIC_PROFILES);
    expect(result.summary).toEqual(SYNTHETIC_SUMMARY);
    // Not invented on the resume path: it never reads the query-depth setting.
    expect(result.resultsPerQuery).toBeUndefined();
    expect(profile).toHaveBeenCalledTimes(1);
  });

  it('persists an empty companies array for a completed run that found no companies', async () => {
    const prisma = makePrisma(queuedRow());
    const harness = makeService({
      prisma: prisma.prisma,
      profiling: async () => profilingResult([]),
    });

    await runToTerminal(harness.service, prisma, 'COMPLETED');

    const result = prisma.row.result as Record<string, unknown>;

    expect(result.companies).toEqual([]);
    expect(result.schemaVersion).toBe(1);
    expect(prisma.row.status).toBe('COMPLETED');
  });

  it('marks the run FAILED when the stage-04 output is missing instead of reporting a false completion', async () => {
    const prisma = makePrisma(queuedRow());
    const harness = makeService({
      prisma: prisma.prisma,
      profiling: async () => ({ domains: undefined }),
    });

    await runToTerminal(harness.service, prisma, 'FAILED');

    expect(prisma.row.status).toBe('FAILED');
    expect(prisma.row.result).toBeNull();
    expect(prisma.row.executionToken).toBeNull();
    expect(String(prisma.row.error)).toContain('stage-04 company profile list');
    expect(prisma.completionAttempts).toBe(0);
  });

  it('keeps FAILED when writing the final result fails', async () => {
    const prisma = makePrisma(queuedRow(), 'throw');
    const harness = makeService({ prisma: prisma.prisma });

    await runToTerminal(harness.service, prisma, 'FAILED');

    expect(prisma.row.status).toBe('FAILED');
    expect(prisma.row.result).toBeNull();
    expect(prisma.completionAttempts).toBe(1);
    expect(String(prisma.row.error)).toContain('simulated persistence failure');
  });

  it('never overwrites another execution result when the lease was lost', async () => {
    const prisma = makePrisma(queuedRow());
    const harness = makeService({
      prisma: prisma.prisma,
      profiling: async () => {
        prisma.stealLease();
        return profilingResult();
      },
    });

    await harness.service.start(DTO);
    await vi.waitFor(() => expect(prisma.completionAttempts).toBe(1));

    expect(prisma.row.status).toBe('RUNNING');
    expect(prisma.row.executionToken).toBe('other-execution-token');
    expect(prisma.row.result).toBeNull();
  });

  it('keeps the existing failure semantics when a stage throws', async () => {
    const prisma = makePrisma(queuedRow());
    const harness = makeService({
      prisma: prisma.prisma,
      collect: async () => {
        throw new Error('synthetic stage failure');
      },
    });

    await runToTerminal(harness.service, prisma, 'FAILED');

    expect(prisma.row.status).toBe('FAILED');
    expect(prisma.row.stage).toBeNull();
    expect(prisma.row.result).toBeNull();
    expect(String(prisma.row.error)).toContain('synthetic stage failure');
    expect(harness.profile).not.toHaveBeenCalled();
  });

  it('keeps resume rejection semantics for a run without stage-01/stage-02 state', async () => {
    const prisma = makePrisma({ ...queuedRow(), id: 'job-incomplete', status: 'INTERRUPTED' });
    const service = new ResearchService(
      {} as ProductIdentificationService,
      {} as PageCollectionService,
      {} as PageAssessmentService,
      { profile: vi.fn(async () => profilingResult()) } as unknown as CompanyProfilingService,
      prisma.prisma,
      {} as SettingsService,
    );

    await expect(service.resume('job-incomplete')).rejects.toThrow(
      'stage 01 or stage 02 result is missing',
    );
    expect(prisma.row.status).toBe('INTERRUPTED');
  });

  it('serves historical unversioned results unchanged', async () => {
    const legacyResult = {
      completedThrough: '03-page-collection',
      identificationPageCount: 12,
      resultsPerQuery: 40,
      selectedPageCount: 310,
    };
    const prisma = makePrisma({
      ...queuedRow(),
      id: 'job-legacy',
      status: 'COMPLETED',
      result: legacyResult,
    });
    const service = new ResearchService(
      {} as ProductIdentificationService,
      {} as PageCollectionService,
      {} as PageAssessmentService,
      {} as CompanyProfilingService,
      prisma.prisma,
      {} as SettingsService,
    );

    const served = await new ResearchController(service).getById('job-legacy');

    expect(served.result).toEqual(legacyResult);
    expect(served).not.toHaveProperty('executionToken');
    expect(served).not.toHaveProperty('executionLeaseUntil');
  });

  it('returns every persisted company profile through the API without truncation', async () => {
    const manyServices = Array.from({ length: 77 }, (_, index) =>
      profile(`synthetic-${index}.example`, index % 2),
    );
    const persisted = {
      schemaVersion: 1,
      completedThrough: '04-company-profiling',
      companies: manyServices,
      summary: SYNTHETIC_SUMMARY,
      resultsPerQuery: 40,
    };
    const prisma = makePrisma({
      ...queuedRow(),
      id: 'job-many',
      status: 'COMPLETED',
      result: persisted,
      executionToken: 'internal-token',
      executionLeaseUntil: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = new ResearchService(
      {} as ProductIdentificationService,
      {} as PageCollectionService,
      {} as PageAssessmentService,
      {} as CompanyProfilingService,
      prisma.prisma,
      {} as SettingsService,
    );

    const served = await new ResearchController(service).getById('job-many');
    const result = served.result as { companies: CompanyProfile[] };

    expect(result.companies).toHaveLength(77);
    expect(result.companies).toEqual(manyServices);
    expect(served).not.toHaveProperty('executionToken');
    expect(served).not.toHaveProperty('executionLeaseUntil');
  });
});

describe('prepared historical recovery guards', () => {
  const ARTIFACT_SHA =
    '0a15a59e03363a54e65018ca4f43fa1d807d610fe7ce81bc6dc44a5f205258de';
  const TARGET_ID = 'cmww8smxb0000z4swhooukamv';
  const ORIGINAL_RESULT = {
    completedThrough: '04-company-profiling',
    resultsPerQuery: 40,
  };

  function defaultTarget() {
    return {
      jobId: TARGET_ID,
      status: 'COMPLETED',
      result: { ...ORIGINAL_RESULT },
      stage03DomainCount: 77,
    };
  }

  function defaultArtifact() {
    return {
      sha256: ARTIFACT_SHA,
      domains: Array.from({ length: 77 }, (_, index) =>
        profile(`recovered-${index}.example`, index % 2),
      ),
      summary: SYNTHETIC_SUMMARY,
    };
  }

  /** Builds a fully consistent input, recomputing the approval fingerprint per target. */
  function input(overrides: Record<string, unknown> = {}) {
    const target = { ...defaultTarget(), ...((overrides.target as object) ?? {}) };
    const artifact = { ...defaultArtifact(), ...((overrides.artifact as object) ?? {}) };
    return {
      expectedJobId: TARGET_ID,
      expectedOriginalResult: { ...ORIGINAL_RESULT },
      expectedArtifactSha256: ARTIFACT_SHA,
      expectedCompanyCount: 77,
      target,
      artifact,
      expectedTargetFingerprint: targetRecoveryFingerprint(target),
      ...overrides,
    };
  }

  it('produces the versioned result for the confirmed target and keeps its metadata', () => {
    const plan = prepareHistoricalResultRecovery(input());

    expect(plan.jobId).toBe(TARGET_ID);
    expect(plan.artifactSha256).toBe(ARTIFACT_SHA);
    expect(plan.finalResult.schemaVersion).toBe(1);
    expect(plan.finalResult.completedThrough).toBe('04-company-profiling');
    expect(plan.finalResult.companies).toHaveLength(77);
    expect(plan.finalResult.resultsPerQuery).toBe(40);
    expect(plan.finalResult.summary).toEqual(SYNTHETIC_SUMMARY);
  });

  it('rejects a different research identifier', () => {
    expect(() =>
      prepareHistoricalResultRecovery(input({ expectedJobId: 'cmwvzov2a0000h0swtjwaracp' })),
    ).toThrow('job id does not match');
  });

  it('rejects a non-completed target', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({ target: { ...defaultTarget(), status: 'FAILED' } }),
      ),
    ).toThrow('not COMPLETED');
  });

  it('rejects an artifact whose fingerprint differs from the archived file', () => {
    expect(() =>
      prepareHistoricalResultRecovery(input({ expectedArtifactSha256: 'ffffffff' })),
    ).toThrow('fingerprint does not match the archived file');
  });

  it('rejects an empty artifact', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({ artifact: { ...defaultArtifact(), domains: [] } }),
      ),
    ).toThrow('contains no company profiles');
  });

  it('rejects an artifact whose profile count is not the confirmed count', () => {
    expect(() =>
      prepareHistoricalResultRecovery(input({ expectedCompanyCount: 76 })),
    ).toThrow('profile count does not match the confirmed count');
  });

  it('rejects a target that already carries company profiles', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({
          target: {
            ...defaultTarget(),
            result: {
              ...ORIGINAL_RESULT,
              companies: [{ domain: 'already.example' }],
            },
          },
        }),
      ),
    ).toThrow('already contains company profiles');
  });

  it('rejects a legitimate empty companies array instead of treating it as missing data', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({
          target: {
            ...defaultTarget(),
            result: { ...ORIGINAL_RESULT, companies: [] },
          },
        }),
      ),
    ).toThrow('empty companies array');
  });

  it('rejects an already recovered record', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({
          target: {
            ...defaultTarget(),
            result: {
              schemaVersion: 1,
              completedThrough: '04-company-profiling',
              companies: Array.from({ length: 77 }, (_, index) =>
                profile(`recovered-${index}.example`, index % 2),
              ),
              summary: SYNTHETIC_SUMMARY,
              resultsPerQuery: 40,
            },
          },
        }),
      ),
    ).toThrow('already contains company profiles');
  });

  it('rejects a result that changed since the approved pre-recovery state', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({
          target: {
            ...defaultTarget(),
            result: { completedThrough: '04-company-profiling', resultsPerQuery: 41 },
          },
        }),
      ),
    ).toThrow('does not match the verified pre-recovery result');
  });

  it('rejects a completion label that is not the historical stage-04 completion', () => {
    const wrongEnvelope = {
      completedThrough: '03-page-assessment',
      resultsPerQuery: 40,
    };
    expect(() =>
      prepareHistoricalResultRecovery(
        input({
          target: { ...defaultTarget(), result: wrongEnvelope },
          expectedOriginalResult: { ...wrongEnvelope },
        }),
      ),
    ).toThrow('not the historical stage-04 completion');
  });

  it('rejects a target whose stage-03 domain count disagrees with the artifact', () => {
    expect(() =>
      prepareHistoricalResultRecovery(
        input({ target: { ...defaultTarget(), stage03DomainCount: 76 } }),
      ),
    ).toThrow('stage-03 domain count does not match');
  });

  it('rejects a target fingerprint that differs from the approved baseline', () => {
    expect(() =>
      prepareHistoricalResultRecovery(input({ expectedTargetFingerprint: 'ffffffff' })),
    ).toThrow('target fingerprint does not match the approved baseline');
  });
});
