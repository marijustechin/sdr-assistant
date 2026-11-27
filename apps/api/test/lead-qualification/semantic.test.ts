import { describe, expect, it } from 'vitest';

import {
  LlmSemanticAssessor,
  SemanticValidationError,
  parseJsonObject,
  validateSemanticAssessment,
} from '../../src/modules/lead-qualification/lead-qualification.semantic.js';
import type { SemanticRequest } from '../../src/modules/lead-qualification/lead-qualification.types.js';
import { semanticAssessment, sourceCompany } from './helpers.js';

function request(): SemanticRequest {
  return {
    targetCountry: 'Lithuania',
    productName: 'Researched product',
    productDescription: 'Synthetic product.',
    company: {
      name: 'Alpha UAB',
      domain: 'alpha.test',
      address: 'Test Street 1',
      city: 'Vilnius',
      country: 'Lithuania',
      offers: [
        {
          id: 'offer-1',
          item: 'Researched product',
          verdict: 'a',
          sourceUrl: 'https://alpha.test/product',
        },
      ],
    },
    focus: ['activity', 'geography', 'relevance'],
    pages: [
      {
        url: 'https://alpha.test/',
        text: 'Alpha UAB product catalogue shop about company Alpha UAB Test Street 1 Vilnius Researched product',
      },
    ],
    existingEvidence: [],
  };
}

describe('SDR-007A semantic assessment contract', () => {
  it('validates exact quotes and supplied URLs', () => {
    const assessment = validateSemanticAssessment(semanticAssessment(), request());
    expect(assessment.activity).toBe('active');
    expect(assessment.geography).toBe('local');
    expect(assessment.relevance).toBe('relevant');
  });

  it('rejects a quote that is not present in the supplied page', () => {
    const answer = semanticAssessment({
      activityEvidence: [
        { quote: 'not present in the page', sourceUrl: 'https://alpha.test/' },
      ],
    });
    expect(() => validateSemanticAssessment(answer, request())).toThrowError(
      SemanticValidationError,
    );
  });

  it('rejects an unsupplied source URL', () => {
    const answer = semanticAssessment({
      activityEvidence: [
        { quote: 'Alpha UAB product', sourceUrl: 'https://elsewhere.test/' },
      ],
    });
    expect(() => validateSemanticAssessment(answer, request())).toThrowError(
      /unsupplied URL/,
    );
  });

  it('rejects a non-unclear conclusion without evidence', () => {
    const answer = semanticAssessment({ activityEvidence: [] });
    expect(() => validateSemanticAssessment(answer, request())).toThrowError(
      /needs evidence/,
    );
  });

  it('rejects an unsupplied offer id in relevance evidence', () => {
    const answer = semanticAssessment({
      relevanceEvidence: [
        {
          offerId: 'offer-999',
          quote: 'Researched product',
          sourceUrl: 'https://alpha.test/',
        },
      ],
    });
    expect(() => validateSemanticAssessment(answer, request())).toThrowError(
      /offer id/,
    );
  });

  it('uses a bounded one-call chat adapter and returns usage', async () => {
    const answer = JSON.stringify(semanticAssessment());
    const assessor = new LlmSemanticAssessor(
      async () => ({
        choices: [
          {
            message: { content: answer },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
      16_000,
    );
    const result = await assessor.assess(request());
    expect(result.assessment.activity).toBe('active');
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(20);
  });

  it('rejects a local branch that contradicts a foreign geography conclusion', () => {
    const answer = semanticAssessment({
      geography: 'foreign',
      localBranch: {
        present: true,
        quote: 'Alpha UAB Test Street 1 Vilnius',
        sourceUrl: 'https://alpha.test/',
      },
    });
    expect(() => validateSemanticAssessment(answer, request())).toThrowError(
      /contradict/,
    );
  });

  it('allocates bounded input across pages instead of letting a large homepage win', async () => {
    let captured: SemanticRequest | null = null;
    const answer = JSON.stringify(
      semanticAssessment({
        activity: 'unclear',
        activityEvidence: [],
        geography: 'unclear',
        geographyEvidence: [],
        relevance: 'unclear',
        relevanceEvidence: [],
      }),
    );
    const assessor = new LlmSemanticAssessor(
      async (_config, _prompt, payload) => {
        captured = payload as SemanticRequest;
        return {
          choices: [{ message: { content: answer }, finish_reason: 'stop' }],
        };
      },
      4_000,
    );
    const large = 'x'.repeat(20_000);
    await assessor.assess({
      ...request(),
      pages: [
        { url: 'https://alpha.test/', text: large },
        { url: 'https://alpha.test/contact', text: large },
        { url: 'https://alpha.test/imprint', text: large },
      ],
    });
    expect(captured).not.toBeNull();
    expect(captured!.pages).toHaveLength(3);
    expect(captured!.pages.every((page) => page.text.length <= 1_000)).toBe(true);
    expect(captured!.focus).toEqual(['activity', 'geography', 'relevance']);
  });

  it('parses a JSON object only from the supplied text', () => {
    expect(parseJsonObject('prefix {"activity":"unclear"} suffix')).toEqual({
      activity: 'unclear',
    });
    expect(() => parseJsonObject('no object')).toThrowError(
      SemanticValidationError,
    );
  });
});
