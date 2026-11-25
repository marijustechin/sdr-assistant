import { describe, expect, it, vi } from 'vitest';

import type { PageAssessmentResult } from '../src/modules/research/stages/03-page-assessment/page-assessment-result.js';
import type { PageAssessmentService } from '../src/modules/research/stages/03-page-assessment/page-assessment.service.js';
import type { PageCollectionService } from '../src/modules/research/stages/02-page-collection/page-collection.service.js';
import type { ProductIdentificationService } from '../src/modules/research/stages/01-product-identification/product-identification.service.js';
import type { CompanyProfilingService } from '../src/modules/research/stages/04-company-profiling/company-profiling.service.js';
import type { PrismaService } from '../src/modules/prisma/prisma.service.js';
import type { SettingsService } from '../src/modules/settings/settings.service.js';
import { ResearchService } from '../src/modules/research/research.service.js';

const page = {
  url: 'https://seller.example/p1',
  canonicalUrl: 'https://seller.example/p1',
  domain: 'seller.example',
  title: 'Seller',
  highlights: [],
  snippets: [],
  summary: null,
  content: 'Seller page',
};

const emptyResult: PageAssessmentResult = {
  targetCountry: 'Lithuania',
  targetLanguage: 'lt',
  product: {
    productName: 'Termo abachi dailylentė',
    categoryName: 'Pirties dailylentės',
    generalCategoryName: 'Dailylentės',
    description: 'Thermally modified abachi cladding',
  },
  domains: [],
};

type MutableResearch = {
  id: string;
  productId: string;
  country: string;
  status: string;
  executionToken: string | null;
  executionLeaseUntil: Date | null;
  product: { id: string; name: string; description: string };
  stage01Result: {
    identifiedProduct: {
      productName: string;
      categoryName: string;
      generalCategoryName: string;
    };
    preparedCandidates: unknown[];
  };
  stage02Result: { result: unknown[] };
  stage03Result: {
    criteria: { category: string; traits: { name: string; expected: string }[] };
    promptVersion: string;
  };
};

function makeHarness() {
  let current: MutableResearch = {
    id: 'job-resume',
    productId: 'product-1',
    country: 'Lithuania',
    status: 'INTERRUPTED',
    executionToken: null,
    executionLeaseUntil: null,
    product: {
      id: 'product-1',
      name: 'Termo abachi dailylentė',
      description: 'Thermally modified abachi cladding',
    },
    stage01Result: {
      identifiedProduct: {
        productName: 'Termo abachi dailylentė',
        categoryName: 'Pirties dailylentės',
        generalCategoryName: 'Dailylentės',
      },
      preparedCandidates: [],
    },
    stage02Result: { result: [page] },
    stage03Result: {
      criteria: {
        language: 'lt',
        traits: [{ name: 'material', expected: 'abachi' }],
      },
      promptVersion: 'page-assessment-v5',
    },
  };

  let resolveResume!: (value: PageAssessmentResult) => void;
  let rejectResume!: (reason: unknown) => void;
  const resumePromise = new Promise<PageAssessmentResult>((resolve, reject) => {
    resolveResume = resolve;
    rejectResume = reject;
  });

  const prisma = {
    research: {
      findUnique: vi.fn(async () => current),
      updateMany: vi.fn(async (args: {
        where: { OR?: unknown[]; executionToken?: string };
        data: Record<string, unknown>;
      }) => {
        if (args.where.OR) {
          if (
            current.executionLeaseUntil !== null &&
            current.executionLeaseUntil > new Date()
          ) {
            return { count: 0 };
          }

          current = {
            ...current,
            status: 'RUNNING',
            executionToken: String(args.data.executionToken),
            executionLeaseUntil: args.data.executionLeaseUntil as Date,
          };
          return { count: 1 };
        }

        if (args.data.status === 'COMPLETED' || args.data.status === 'FAILED') {
          current = {
            ...current,
            status: String(args.data.status),
            executionToken: null,
            executionLeaseUntil: null,
          };
        }

        return { count: 1 };
      }),
    },
    researchStage03: {
      findUnique: vi.fn(async () => ({ errorPages: 0 })),
    },
  };

  const pageAssessment = {
    resumePages: vi.fn(async () => resumePromise),
  };
  const companyProfiling = {
    profile: vi.fn(async () => ({ domains: [] })),
  };
  const identify = vi.fn();
  const collect = vi.fn();

  const service = new ResearchService(
    { identify } as unknown as ProductIdentificationService,
    { collect } as unknown as PageCollectionService,
    pageAssessment as unknown as PageAssessmentService,
    companyProfiling as unknown as CompanyProfilingService,
    prisma as unknown as PrismaService,
    {} as SettingsService,
  );

  return {
    service,
    prisma,
    pageAssessment,
    companyProfiling,
    identify,
    collect,
    resolveResume: () => resolveResume(emptyResult),
    rejectResume,
    get current() {
      return current;
    },
  };
}

describe('ResearchService.resume', () => {
  it('claims the job once and never runs 01/02', async () => {
    const harness = makeHarness();

    const first = await harness.service.resume('job-resume');

    expect(first).toEqual({ jobId: 'job-resume', status: 'RUNNING' });
    await vi.waitFor(() => {
      expect(harness.pageAssessment.resumePages).toHaveBeenCalledTimes(1);
    });
    expect(harness.identify).not.toHaveBeenCalled();
    expect(harness.collect).not.toHaveBeenCalled();
    expect(harness.prisma.research.updateMany).toHaveBeenCalled();

    const second = harness.service.resume('job-resume');
    await expect(second).rejects.toThrow('already running');

    harness.resolveResume();
    await vi.waitFor(() => {
      expect(harness.current.status).toBe('COMPLETED');
    });
  });
});
