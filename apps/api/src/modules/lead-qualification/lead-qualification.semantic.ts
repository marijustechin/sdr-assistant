import { z } from 'zod';

import type { LLMConfig, DeepSeekResponse } from '../research/types.js';
import { llmChat } from '../research/lib/llm-chat.js';
import { LEAD_QUALIFICATION_SEMANTIC_PROMPT } from './lead-qualification.prompt.js';
import type {
  SemanticAssessment,
  SemanticEvidence,
  SemanticRequest,
} from './lead-qualification.types.js';

const evidenceSchema = z.object({
  quote: z.string().min(1),
  sourceUrl: z.string().min(1),
});

const answerSchema = z.object({
  activity: z.enum(['active', 'inactive', 'unclear']),
  activityEvidence: z.array(evidenceSchema).default([]),
  geography: z.enum(['local', 'foreign', 'unclear']),
  geographyEvidence: z
    .array(
      evidenceSchema.extend({
        kind: z.enum(['address', 'branch', 'legal', 'pickup']),
      }),
    )
    .default([]),
  localBranch: z
    .object({
      present: z.boolean(),
      quote: z.string().nullish(),
      sourceUrl: z.string().nullish(),
    })
    .nullish(),
  relevance: z.enum(['relevant', 'irrelevant', 'unclear']),
  relevanceEvidence: z
    .array(
      evidenceSchema.extend({
        offerId: z.string().nullish(),
      }),
    )
    .default([]),
  notes: z.string().nullish(),
});

export class SemanticValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticValidationError';
  }
}

export type SemanticAssessmentResult = {
  assessment: SemanticAssessment;
  promptTokens: number | null;
  completionTokens: number | null;
  model: string;
};

export interface SemanticAssessor {
  assess(request: SemanticRequest): Promise<SemanticAssessmentResult>;
}

export type SemanticChat = (
  config: LLMConfig,
  systemPrompt: string,
  userContent: object,
) => Promise<DeepSeekResponse>;

const SEMANTIC_CONFIG: LLMConfig = {
  model: 'deepseek-flash',
  max_tokens: 2_000,
  temperature: 0,
  thinking: { type: 'disabled' },
};

export function parseJsonObject(raw: string): unknown {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');

  if (first < 0 || last < first) {
    throw new SemanticValidationError('The semantic answer was not a JSON object.');
  }

  try {
    return JSON.parse(raw.slice(first, last + 1)) as unknown;
  } catch {
    throw new SemanticValidationError('The semantic answer was malformed JSON.');
  }
}

function validateEvidence(
  item: z.infer<typeof evidenceSchema>,
  pages: ReadonlyMap<string, string>,
): SemanticEvidence {
  const text = pages.get(item.sourceUrl);
  if (text === undefined) {
    throw new SemanticValidationError(
      `The semantic answer referenced an unsupplied URL: ${item.sourceUrl}`,
    );
  }
  if (!text.includes(item.quote)) {
    throw new SemanticValidationError(
      `The semantic quote was not found in ${item.sourceUrl}.`,
    );
  }
  return { quote: item.quote, sourceUrl: item.sourceUrl };
}

/**
 * Validates the model's classification response against the exact supplied
 * page texts. Invalid quotes/URLs are rejected, never silently accepted.
 */
export function validateSemanticAssessment(
  raw: unknown,
  request: SemanticRequest,
): SemanticAssessment {
  const answer = answerSchema.parse(raw);
  const pages = new Map(request.pages.map((page) => [page.url, page.text]));
  const activityEvidence = answer.activityEvidence.map((item) =>
    validateEvidence(item, pages),
  );
  const geographyEvidence = answer.geographyEvidence.map((item) => {
    const evidence = validateEvidence(item, pages);
    return { ...evidence, kind: item.kind };
  });
  const relevanceEvidence = answer.relevanceEvidence.map((item) => {
    const evidence = validateEvidence(item, pages);
    if (
      item.offerId !== null &&
      item.offerId !== undefined &&
      !request.company.offers.some((offer) => offer.id === item.offerId)
    ) {
      throw new SemanticValidationError(
        `The semantic answer referenced an unsupplied offer id: ${item.offerId}`,
      );
    }
    return { ...evidence, offerId: item.offerId ?? null };
  });

  if (answer.activity !== 'unclear' && activityEvidence.length === 0) {
    throw new SemanticValidationError('A non-unclear activity needs evidence.');
  }
  if (answer.geography !== 'unclear' && geographyEvidence.length === 0) {
    throw new SemanticValidationError('A non-unclear geography needs evidence.');
  }
  if (answer.relevance !== 'unclear' && relevanceEvidence.length === 0) {
    throw new SemanticValidationError('A non-unclear relevance needs evidence.');
  }

  let localBranch: SemanticAssessment['localBranch'] = null;
  if (answer.localBranch?.present === true) {
    if (!answer.localBranch.quote || !answer.localBranch.sourceUrl) {
      throw new SemanticValidationError('A local branch needs a quote and source URL.');
    }
    const evidence = validateEvidence(
      {
        quote: answer.localBranch.quote,
        sourceUrl: answer.localBranch.sourceUrl,
      },
      pages,
    );
    localBranch = {
      present: true,
      quote: evidence.quote,
      sourceUrl: evidence.sourceUrl,
    };
  } else if (answer.localBranch) {
    localBranch = { present: false, quote: null, sourceUrl: null };
  }

  if (localBranch?.present === true && answer.geography === 'foreign') {
    throw new SemanticValidationError(
      'A local-branch conclusion cannot contradict a foreign geography conclusion.',
    );
  }

  return {
    activity: answer.activity,
    activityEvidence,
    geography: answer.geography,
    geographyEvidence,
    localBranch,
    relevance: answer.relevance,
    relevanceEvidence,
    notes: answer.notes ?? null,
  };
}

function boundedRequest(
  request: SemanticRequest,
  maxChars: number,
): SemanticRequest {
  const pages = request.pages.slice(0, 4);
  const metadataReserve = Math.min(4_000, Math.floor(maxChars * 0.25));
  const pageBudget = Math.max(0, maxChars - metadataReserve);
  const perPage = pages.length === 0 ? 0 : Math.floor(pageBudget / pages.length);
  const boundedPages = pages.map((page) => ({
    url: page.url,
    text: page.text.slice(0, Math.max(0, Math.min(perPage, 4_000))),
  }));

  const bounded: SemanticRequest = {
    ...request,
    productName: request.productName.slice(0, 300),
    productDescription: request.productDescription.slice(0, 2_000),
    company: {
      ...request.company,
      name: request.company.name?.slice(0, 300) ?? null,
      address: request.company.address?.slice(0, 500) ?? null,
      city: request.company.city?.slice(0, 200) ?? null,
      country: request.company.country?.slice(0, 200) ?? null,
      offers: request.company.offers.slice(0, 30).map((offer) => ({
        ...offer,
        item: offer.item.slice(0, 200),
      })),
    },
    pages: boundedPages.filter((page) => page.text.length > 0),
  };

  // Enforce the cap on the complete request, not only page excerpts.
  while (JSON.stringify(bounded).length > maxChars && bounded.pages.length > 0) {
    const largest = bounded.pages.reduce((left, right) =>
      left.text.length >= right.text.length ? left : right,
    );
    const nextLength = Math.max(0, largest.text.length - 200);
    if (nextLength === largest.text.length) break;
    largest.text = largest.text.slice(0, nextLength);
    if (largest.text.length === 0) {
      bounded.pages = bounded.pages.filter((page) => page.text.length > 0);
    }
  }

  return bounded;
}

export class LlmSemanticAssessor implements SemanticAssessor {
  constructor(
    private readonly chat: SemanticChat = llmChat,
    private readonly maxChars = 16_000,
  ) {}

  async assess(request: SemanticRequest): Promise<SemanticAssessmentResult> {
    const bounded = boundedRequest(request, this.maxChars);
    const response = await this.chat(
      SEMANTIC_CONFIG,
      LEAD_QUALIFICATION_SEMANTIC_PROMPT,
      bounded,
    );
    const raw = response.choices[0]?.message.content ?? '';
    const assessment = validateSemanticAssessment(parseJsonObject(raw), bounded);

    return {
      assessment,
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      model: SEMANTIC_CONFIG.model,
    };
  }
}
