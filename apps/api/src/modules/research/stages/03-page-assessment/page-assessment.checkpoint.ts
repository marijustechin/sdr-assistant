import type { PageAssessmentInput } from '../../types.js';
import { buildPageAssessmentResult } from './page-assessment-result.js';
import type { PageAssessmentResult } from './page-assessment-result.js';
import type {
  PageFactsV4,
  StudyCriteria,
} from './page-assessment.schema.js';
import type {
  AssessmentReason,
  AssessmentVerdict,
} from './page-assessment.verdict.js';

export type PageAssessmentDecision = {
  pageIndex: number;
  url: string;
  canonicalUrl: string;
  status: 'decided' | 'error';
  verdict: AssessmentVerdict | null;
  reason: AssessmentReason | null;
  facts: PageFactsV4 | null;
  excludedFrom04: 'offer_language_mismatch' | null;
  error: string | null;
};

export type PageAssessmentState = {
  criteria: StudyCriteria;
  promptVersion: string;
  decisions: PageAssessmentDecision[];
};

export function countDecisions(decisions: readonly PageAssessmentDecision[]): {
  decidedPages: number;
  errorPages: number;
} {
  let decidedPages = 0;
  let errorPages = 0;

  for (const decision of decisions) {
    if (decision.status === 'error') errorPages += 1;
    else decidedPages += 1;
  }

  return { decidedPages, errorPages };
}

export type AssessedPage = {
  url: string;
  verdict: AssessmentVerdict;
  reason: AssessmentReason;
  facts: PageFactsV4;
  excludedFrom04: 'offer_language_mismatch' | null;
};

export function decidedAssessments(
  decisions: readonly PageAssessmentDecision[],
): AssessedPage[] {
  const assessments: AssessedPage[] = [];

  for (const decision of decisions) {
    if (decision.status !== 'decided') continue;
    if (
      decision.verdict === null ||
      decision.reason === null ||
      decision.facts === null
    ) {
      continue;
    }

    assessments.push({
      url: decision.url,
      verdict: decision.verdict,
      reason: decision.reason,
      facts: decision.facts,
      excludedFrom04: decision.excludedFrom04,
    });
  }

  return assessments;
}

export function buildResultFromDecisions(
  data: PageAssessmentInput,
  decisions: readonly PageAssessmentDecision[],
): PageAssessmentResult {
  return buildPageAssessmentResult(
    data,
    decidedAssessments(decisions).filter(
      (assessment) => assessment.excludedFrom04 === null,
    ),
  );
}
