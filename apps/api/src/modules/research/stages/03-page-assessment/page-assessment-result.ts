import type { PageAssessmentInput, PageForAssessment } from '../../types.js';
import type { PageFacts } from './page-assessment.schema.js';
import type { AssessmentOutcome } from './page-assessment.verdict.js';

type AssessedPage = AssessmentOutcome & { url: string; facts: PageFacts };

type SelectedPage = {
  page: PageForAssessment;
  verdict: Exclude<AssessmentOutcome['verdict'], 'none'>;
  reason: AssessmentOutcome['reason'];
  facts: PageFacts;
};

export type PageAssessmentResult = Pick<
  PageAssessmentInput,
  'targetCountry' | 'targetLanguage' | 'product'
> & {
  domains: { domain: string; pages: SelectedPage[] }[];
};

export function buildPageAssessmentResult(
  { targetCountry, targetLanguage, product, pages }: PageAssessmentInput,
  assessments: readonly AssessedPage[],
): PageAssessmentResult {
  const pagesByUrl = new Map(pages.map((page) => [page.url, page] as const));
  const byDomain = new Map<string, SelectedPage[]>();

  for (const { url, verdict, reason, facts } of assessments) {
    if (verdict === 'none') continue;

    const page = pagesByUrl.get(url);
    if (!page) throw new Error(`Missing source page for assessment: ${url}`);

    const domain = page.domain.toLowerCase().replace(/^www\./, '');
    let group = byDomain.get(domain);
    if (!group) {
      group = [];
      byDomain.set(domain, group);
    }
    group.push({ page, verdict, reason, facts });
  }

  const domains = Array.from(byDomain, ([domain, pages]) => ({ domain, pages }));
  return { targetCountry, targetLanguage, product, domains };
}
