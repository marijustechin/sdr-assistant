import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateResearchDto } from '../src/modules/research/dto/create-research.dto.js';
import { LlmRequestError } from '../src/modules/research/lib/llm-chat.js';
import type { IdentificationFixture } from '../src/modules/research/lib/research-fixture.lib.js';
import { PageCollectionService } from '../src/modules/research/stages/02-page-collection/page-collection.service.js';
import type {
  PageForAssessment,
  ProductIdentificationResponse,
} from '../src/modules/research/types.js';

const mocks = vi.hoisted(() => ({
  llmChat: vi.fn(),
  searchTermCandidates: vi.fn(),
  fetchMissingPageContent: vi.fn(),
  writeJsonFile: vi.fn(),
}));

vi.mock('../src/modules/research/lib/llm-chat.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, llmChat: mocks.llmChat };
});

vi.mock('../src/modules/research/pipeline/term-search.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, searchTermCandidates: mocks.searchTermCandidates };
});

vi.mock('../src/modules/research/pipeline/fetch-pages.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchMissingPageContent: mocks.fetchMissingPageContent };
});

vi.mock('../src/modules/research/lib/utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, writeJsonFile: mocks.writeJsonFile };
});

const dto: CreateResearchDto = {
  productId: 'product-1',
  name: 'Thermo Abachi Cladding',
  description: 'Thermally modified abachi cladding for saunas',
  country: 'Lithuania',
};

const fixture: IdentificationFixture = {
  input: {
    name: dto.name,
    description: dto.description,
    country: dto.country,
  },
  targetLanguage: 'Lithuanian',
  product: {
    productName: 'Termo abachi dailylentės',
    categoryName: 'Pirties dailylentės',
    generalCategoryName: 'Dailylentės',
  },
  pages: [],
};

function productWith(pages: PageForAssessment[]): ProductIdentificationResponse {
  return { product: fixture.product, sourcePages: pages };
}

function page(index: number): PageForAssessment {
  const domain = `shop${index}.lt`;

  return {
    url: `https://${domain}/produktas-${index}`,
    canonicalUrl: `https://${domain}/produktas-${index}`,
    domain,
    title: `Termo abachi dailylentės ${index}`,
    highlights: [],
    snippets: [],
    summary: null,
    content: 'Termo abachi dailylentės 42,00 €/m²',
  };
}

function triageAnswer(verdict: 'good' | 'none') {
  const content = JSON.stringify({
    verdict,
    evidence: verdict === 'good' ? 'Termo abachi dailylentės' : null,
    reason: verdict === 'none' ? 'Rule 3: the page does not offer the product' : null,
  });

  return { choices: [{ message: { content }, finish_reason: 'stop' }] };
}

function insufficientBalance(): LlmRequestError {
  return new LlmRequestError(
    'DeepSeek API error 402 (insufficient_balance_error): {"error":{}}',
    {
      status: 402,
      type: 'insufficient_balance_error',
      code: 'invalid_request_error',
    },
  );
}

describe('stage 02 page triage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeJsonFile.mockResolvedValue(undefined);
    mocks.searchTermCandidates.mockResolvedValue([]);
  });

  it('stops after the first insufficient balance error and writes no success output', async () => {
    const pages = Array.from({ length: 12 }, (_, index) => page(index));
    mocks.fetchMissingPageContent.mockResolvedValue(
      pages.map((item) => ({ page: item, fetched: false })),
    );

    let started = 0;
    const stages: string[] = [];

    mocks.llmChat.mockImplementation(async () => {
      started += 1;

      if (started === 1) {
        throw insufficientBalance();
      }

      await new Promise((resolve) => setTimeout(resolve, 5));
      return triageAnswer('good');
    });

    const service = new PageCollectionService();

    await expect(
      service.collect(
        dto,
        productWith([]),
        async (stage) => {
          stages.push(stage);
        },
        40,
      ),
    ).rejects.toThrow(
      'Stage 02 page triage stopped: DeepSeek API reported insufficient balance (HTTP 402)',
    );

    // At most the initial batch reached the provider; no page was taken after
    // the fatal answer.
    expect(started).toBeGreaterThanOrEqual(1);
    expect(started).toBeLessThanOrEqual(6);

    const paths = mocks.writeJsonFile.mock.calls.map(([path]) => String(path));

    // Search and fetch stay on disk for reuse; the triage dump and the success
    // output are never written for a failed run.
    expect(paths.some((path) => path.includes('02.1-initial-pages'))).toBe(true);
    expect(paths.some((path) => path.includes('02.2-fetch-results'))).toBe(true);
    expect(paths.some((path) => path.includes('02.3-triage'))).toBe(false);
    expect(
      paths.some((path) => path.includes('02.4-page-collection-response')),
    ).toBe(false);

    // No progress update lands after the failure was detected.
    expect(stages.filter((stage) => stage.startsWith('2.3 ')).length).toBeLessThanOrEqual(6);
  });

  it('lets the remaining pages finish when a single page fails', async () => {
    const pages = Array.from({ length: 8 }, (_, index) => page(index));
    let calls = 0;

    mocks.llmChat.mockImplementation(async () => {
      calls += 1;

      if (calls === 2) {
        throw new Error('DeepSeek API error 500 (server_error): boom');
      }

      return triageAnswer('good');
    });

    const service = new PageCollectionService();
    const results = await service.processPages(pages, fixture);

    expect(results).toHaveLength(pages.length);
    expect(results.filter((result) => result.error !== undefined)).toHaveLength(1);
    expect(
      results.filter((result) => result.triage?.verdict === 'good'),
    ).toHaveLength(pages.length - 1);
    expect(calls).toBe(pages.length);
  });

  it('returns an empty list when every page is none', async () => {
    const pages = Array.from({ length: 5 }, (_, index) => page(index));
    mocks.fetchMissingPageContent.mockResolvedValue(
      pages.map((item) => ({ page: item, fetched: false })),
    );
    mocks.llmChat.mockResolvedValue(triageAnswer('none'));

    const service = new PageCollectionService();
    const result = await service.collect(dto, productWith([]));

    expect(result).toEqual([]);

    const paths = mocks.writeJsonFile.mock.calls.map(([path]) => String(path));
    expect(
      paths.some((path) => path.includes('02.4-page-collection-response')),
    ).toBe(true);
  });
});
