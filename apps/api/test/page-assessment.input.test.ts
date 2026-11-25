import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeepSeekResponse, PageForAssessment } from '../src/modules/research/types.js';
import type { PageFactsV4 } from '../src/modules/research/stages/03-page-assessment/page-assessment.schema.js';
import type { PrismaService } from '../src/modules/prisma/prisma.service.js';
import {
  PAGE_ASSESSMENT_PROMPT,
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

type StageRow = {
  jobId: string;
  criteria: unknown;
  promptVersion: string | null;
  decisions: unknown[];
  decidedPages: number;
  errorPages: number;
  result: unknown;
};

class FakePrisma {
  row: StageRow | null = null;

  readonly researchStage03 = {
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

function page(language: string): PageForAssessment {
  return {
    url: `https://seller.example/${language}/product`,
    canonicalUrl: `https://seller.example/${language}/product`,
    domain: 'seller.example',
    title: `Seller page ${language}`,
    highlights: [],
    snippets: [],
    summary: null,
    content: `Seller page ${language}. Local market offer.`,
  };
}

type CaseInput = {
  language: string;
  country: string;
  productName: string;
  categoryName: string;
  generalCategoryName: string;
  facts: PageFactsV4;
  expectedVerdict: 'a' | 'b';
};

const cases: CaseInput[] = [
  {
    language: 'lt',
    country: 'Lithuania',
    productName: 'Termo abachi dailylentė',
    categoryName: 'Pirties dailylentės',
    generalCategoryName: 'Dailylentės',
    expectedVerdict: 'b',
    facts: {
      publisher: 'seller',
      offer: {
        item: 'Termo pušies dailylentė',
        quote: 'Termo pušies dailylentė',
        evidence_type: 'price',
      },
      category: {
        match: 'yes',
        quote: 'Dailylentės',
      },
      traits: {
        material: {
          match: 'differs',
          value: 'Termo pušis',
        },
      },
      market: {
        status: 'target',
        note: 'Local market offer',
      },
      note: 'Seller offers a category variant, not the exact product.',
      offerLanguage: 'target',
    },
  },
  {
    language: 'de',
    country: 'Germany',
    productName: 'Thermo-Abachi-Profilholz',
    categoryName: 'Saunaprofile',
    generalCategoryName: 'Holzprofile',
    expectedVerdict: 'a',
    facts: {
      publisher: 'seller',
      offer: {
        item: 'Thermo-Abachi-Profilholz',
        quote: 'Thermo-Abachi-Profilholz',
        evidence_type: 'price',
      },
      category: {
        match: 'yes',
        quote: 'Saunaprofile',
      },
      traits: {
        material: {
          match: 'confirmed',
          value: 'Abachi',
        },
      },
      market: {
        status: 'target',
        note: 'Local market offer',
      },
      note: 'Exact product.',
      offerLanguage: 'target',
    },
  },
];

function makeService(prisma: FakePrisma): PageAssessmentService {
  return new PageAssessmentService(prisma as unknown as PrismaService);
}

describe('stage 03 assessment request contract', () => {
  beforeEach(() => {
    llmChatMock.mockReset();
  });

  it.each(cases)(
    'passes targetCountry, targetLanguage and all three local product names exactly for $language',
    async (testCase) => {
      const prisma = new FakePrisma();
      const service = makeService(prisma);
      const pageInput = page(testCase.language);
      const requests: unknown[] = [];

      llmChatMock.mockImplementation(
        async (_config: unknown, prompt: string, userContent: unknown) => {
          if (prompt === STUDY_CRITERIA_PROMPT) {
            return reply(
              JSON.stringify({
                language: testCase.language,
                traits: [
                  {
                    name: 'material',
                    expected:
                      testCase.language === 'lt' ? 'abachi' : 'Abachi',
                  },
                ],
              }),
            );
          }

          requests.push(userContent);
          return reply(JSON.stringify(testCase.facts));
        },
      );

      const result = await service.assessPages(
        {
          targetCountry: testCase.country,
          targetLanguage: testCase.language,
          product: {
            productName: testCase.productName,
            categoryName: testCase.categoryName,
            generalCategoryName: testCase.generalCategoryName,
            description: 'English description used only for traits',
          },
          pages: [pageInput],
        },
        `job-${testCase.language}`,
      );

      expect(requests).toHaveLength(1);

      const request = requests[0] as {
        targetCountry: string;
        targetLanguage: string;
        product: {
          productName: string;
          categoryName: string;
          generalCategoryName: string;
        };
      };

      expect(request.targetCountry).toBe(testCase.country);
      expect(request.targetLanguage).toBe(testCase.language);
      expect(request.product.productName).toBe(testCase.productName);
      expect(request.product.categoryName).toBe(testCase.categoryName);
      expect(request.product.generalCategoryName).toBe(
        testCase.generalCategoryName,
      );

      expect(result.domains).toHaveLength(1);
      expect(result.domains[0]?.pages[0]?.verdict).toBe(
        testCase.expectedVerdict,
      );
      expect(prisma.row?.criteria).toEqual(
        expect.objectContaining({ language: testCase.language }),
      );
      expect(prisma.row?.criteria).not.toHaveProperty('category');
    },
  );

  it('uses only generalCategoryName match to yield b when exact traits differ', async () => {
    const testCase = cases[0];
    const prisma = new FakePrisma();
    const service = makeService(prisma);

    llmChatMock.mockImplementation(
      async (_config: unknown, prompt: string) => {
        if (prompt === STUDY_CRITERIA_PROMPT) {
          return reply(
            JSON.stringify({
              language: testCase.language,
              traits: [{ name: 'material', expected: 'abachi' }],
            }),
          );
        }

        return reply(JSON.stringify(testCase.facts));
      },
    );

    const result = await service.assessPages(
      {
        targetCountry: testCase.country,
        targetLanguage: testCase.language,
        product: {
          productName: testCase.productName,
          categoryName: testCase.categoryName,
          generalCategoryName: testCase.generalCategoryName,
          description: 'English description used only for traits',
        },
        pages: [page(testCase.language)],
      },
      'job-category-b',
    );

    expect(result.domains[0]?.pages[0]?.verdict).toBe('b');
    expect(result.domains[0]?.pages[0]?.reason).toBe('traits_differ');
  });
});
