import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeepSeekResponse, PageForAssessment } from '../src/modules/research/types.js';
import type { PageFactsV4 } from '../src/modules/research/stages/03-page-assessment/page-assessment.schema.js';
import type { PageAssessmentDecision } from '../src/modules/research/stages/03-page-assessment/page-assessment.checkpoint.js';
import type { PrismaService } from '../src/modules/prisma/prisma.service.js';
import {
  PAGE_ASSESSMENT_PROMPT,
  PAGE_ASSESSMENT_PROMPT_VERSION,
  STUDY_CRITERIA_PROMPT,
} from '../src/modules/research/stages/03-page-assessment/page-assessment.prompt.js';

const llmChatMock = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/research/lib/llm-chat.js', () => ({
  llmChat: llmChatMock,
  isInsufficientBalanceError: () => false,
}));

vi.mock('../src/modules/research/lib/utils.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../src/modules/research/lib/utils.js')
    >();

  return {
    ...actual,
    writeJsonFile: vi.fn(async () => undefined),
  };
});

import { PageAssessmentService } from '../src/modules/research/stages/03-page-assessment/page-assessment.service.js';

const criteria = {
  language: 'lt',
  traits: [{ name: 'material', expected: 'abachi' }],
};

type StageRow = {
  jobId: string;
  criteria: unknown;
  promptVersion: string | null;
  decisions: PageAssessmentDecision[];
  decidedPages: number;
  errorPages: number;
  result: unknown;
};

class FakePrisma {
  row: StageRow | null = null;

  readonly researchStage03 = {
    findUnique: vi.fn(async () => {
      return this.row === null ? null : structuredClone(this.row);
    }),
    upsert: vi.fn(
      async ({
        create,
        update,
      }: {
        create: StageRow;
        update: Partial<StageRow>;
      }) => {
        if (this.row === null) {
          this.row = structuredClone(create);
        } else {
          Object.assign(this.row, structuredClone(update));
        }

        return this.row;
      },
    ),
    update: vi.fn(async ({ data }: { data: Partial<StageRow> }) => {
      if (this.row === null) throw new Error('Missing stage 03 row');
      Object.assign(this.row, structuredClone(data));
      return this.row;
    }),
  };
}

function reply(content: string): DeepSeekResponse {
  return {
    choices: [{ message: { content }, finish_reason: null }],
  };
}

function page(index: number): PageForAssessment {
  return {
    url: `https://seller-${index}.example/p${index}`,
    canonicalUrl: `https://seller-${index}.example/p${index}`,
    domain: `seller-${index}.example`,
    title: `Page ${index}`,
    highlights: [],
    snippets: [],
    summary: null,
    content: `Page ${index}. ${
      index === 3 ? 'Only Poland.' : 'Selling in Lithuania.'
    }`,
  };
}

function factsFor(index: number): PageFactsV4 {
  const thirdParty = index === 2;
  const languageExcluded = index === 3;

  return {
    publisher: thirdParty ? 'third_party' : 'seller',
    offer: {
      item: null,
      quote: null,
      evidence_type: thirdParty ? 'none' : 'price',
    },
    category: {
      match: thirdParty ? 'unknown' : 'yes',
      quote: null,
    },
    traits: {
      material: {
        match: index === 1 ? 'unknown' : 'confirmed',
        value: null,
      },
    },
    market: languageExcluded
      ? { status: 'other', note: 'Only Poland' }
      : { status: 'target', note: 'Selling in Lithuania' },
    note: '',
    offerLanguage: languageExcluded ? 'other' : 'target',
  };
}

const pages = Array.from({ length: 12 }, (_, index) => page(index));

const input = {
  targetCountry: 'Lithuania',
  targetLanguage: 'lt',
  product: {
    productName: 'Termo abachi dailylentė',
    categoryName: 'Pirties dailylentės',
    generalCategoryName: 'Dailylentės',
    description: 'Thermally modified abachi cladding',
  },
  pages,
};

function makeService(prisma: FakePrisma): PageAssessmentService {
  return new PageAssessmentService(
    prisma as unknown as PrismaService,
  );
}

function pageCallsByUrl(): Map<string, number> {
  const counts = new Map<string, number>();
  const calls = llmChatMock.mock.calls as unknown as [
    unknown,
    string,
    { page?: { url?: string } },
  ][];

  for (const call of calls) {
    if (call[1] !== PAGE_ASSESSMENT_PROMPT) continue;
    const url = call[2].page?.url;
    if (url) counts.set(url, (counts.get(url) ?? 0) + 1);
  }

  return counts;
}

function criteriaCalls(): number {
  return (llmChatMock.mock.calls as unknown as [unknown, string][]).filter(
    (call) => call[1] === STUDY_CRITERIA_PROMPT,
  ).length;
}

describe('stage 03 resume', () => {
  beforeEach(() => {
    llmChatMock.mockReset();
    llmChatMock.mockImplementation(
      async (_config: unknown, prompt: string, userContent: unknown) => {
        if (prompt === STUDY_CRITERIA_PROMPT) {
          return reply(JSON.stringify(criteria));
        }

        const pageUrl = (
          userContent as { page: { url: string } }
        ).page.url;
        const index = Number(/p(\d+)$/u.exec(pageUrl)?.[1]);

        return reply(JSON.stringify(factsFor(index)));
      },
    );
  });

  it('resumes after a saved five-page batch without repeating 01/02, criteria or final pages', async () => {
    const prisma = new FakePrisma();
    const service = makeService(prisma);

    const stop = async (stage: string): Promise<void> => {
      if (stage.startsWith('03.1 Assessing pages 5/12')) {
        throw new Error('simulated process stop');
      }
    };

    await expect(
      service.assessPages(input, 'job-resume', stop),
    ).rejects.toThrow('simulated process stop');

    expect(prisma.row?.decisions).toHaveLength(5);
    expect(prisma.row?.decidedPages).toBe(5);
    expect(
      prisma.row?.decisions.find((decision) => decision.pageIndex === 2)
        ?.verdict,
    ).toBe('none');
    expect(
      prisma.row?.decisions.find((decision) => decision.pageIndex === 3)
        ?.excludedFrom04,
    ).toBe('offer_language_mismatch');
    expect(criteriaCalls()).toBe(1);
    expect(pageCallsByUrl().size).toBe(5);

    const resumed = await service.resumePages(input, 'job-resume');

    expect(resumed).toEqual(
      expect.objectContaining({
        targetCountry: 'Lithuania',
        targetLanguage: 'lt',
      }),
    );
    expect(criteriaCalls()).toBe(1);
    expect(pageCallsByUrl().size).toBe(12);
    expect(pageCallsByUrl().get(pages[0].url)).toBe(1);
    expect(pageCallsByUrl().get(pages[4].url)).toBe(1);
    expect(pageCallsByUrl().get(pages[5].url)).toBe(1);
    expect(pageCallsByUrl().get(pages[11].url)).toBe(1);

    const controlPrisma = new FakePrisma();
    const controlService = makeService(controlPrisma);
    const control = await controlService.assessPages(input, 'job-control');

    expect(resumed).toStrictEqual(control);
    expect(prisma.row?.decisions).toHaveLength(12);
    expect(prisma.row?.decidedPages).toBe(12);
  });

  it('rejects a second concurrent resume in the same process', async () => {
    const prisma = new FakePrisma();
    const service = makeService(prisma);

    await expect(
      service.assessPages(input, 'job-double', async (stage) => {
        if (stage.startsWith('03.1 Assessing pages 5/12')) {
          throw new Error('simulated process stop');
        }
      }),
    ).rejects.toThrow('simulated process stop');

    const results = await Promise.allSettled([
      service.resumePages(input, 'job-double'),
      service.resumePages(input, 'job-double'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    );
    expect(pageCallsByUrl().size).toBe(12);
  });

  it('reprocesses a batch that was interrupted before its checkpoint', async () => {
    const prisma = new FakePrisma();
    const service = makeService(prisma);

    await expect(
      service.assessPages(input, 'job-early-stop', async (stage) => {
        if (stage.startsWith('03.1 Assessing pages 2/12')) {
          throw new Error('simulated process stop');
        }
      }),
    ).rejects.toThrow('simulated process stop');

    expect(prisma.row?.decisions).toHaveLength(0);

    await service.resumePages(input, 'job-early-stop');

    expect(pageCallsByUrl().size).toBe(12);
    expect(prisma.row?.decisions).toHaveLength(12);
  });

  it('does not retry a saved technical error decision', async () => {
    const prisma = new FakePrisma();
    const service = makeService(prisma);
    const decided = pages.slice(1).map((entry, offset) => {
      const index = offset + 1;
      return {
        pageIndex: index,
        url: entry.url,
        canonicalUrl: entry.canonicalUrl,
        status: 'decided' as const,
        verdict: 'a' as const,
        reason: 'exact' as const,
        facts: factsFor(index),
        excludedFrom04: null,
        error: null,
      };
    });

    prisma.row = {
      jobId: 'job-error-resume',
      criteria,
      promptVersion: PAGE_ASSESSMENT_PROMPT_VERSION,
      decisions: [
        {
          pageIndex: 0,
          url: pages[0].url,
          canonicalUrl: pages[0].canonicalUrl,
          status: 'error',
          verdict: null,
          reason: null,
          facts: null,
          excludedFrom04: null,
          error: 'previous technical failure',
        },
        ...decided,
      ],
      decidedPages: 11,
      errorPages: 1,
      result: null,
    };

    await service.resumePages(input, 'job-error-resume');

    expect(pageCallsByUrl().has(pages[0].url)).toBe(false);
    expect(prisma.row?.decisions).toHaveLength(12);
    expect(prisma.row?.errorPages).toBe(1);
  });
});
