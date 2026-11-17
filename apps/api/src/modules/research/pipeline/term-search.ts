import { dsSearch } from '../lib/ds-search.js';
import { searchExa } from '../lib/exa-search.js';
import type {
  TermCandidates,
  TermSearchResult,
  TermSearchRun,
} from '../types.js';

export type TermSearchOptions = {
  country: string;
  resultsPerQuery: number;
  concurrency?: number;
};

const DEFAULT_CONCURRENCY = 4;

/**
 * Runs every term candidate through both search providers.
 *
 * Requests are grouped into sequential batches of `concurrency` so one provider
 * outage cannot fan out into an unbounded number of calls. A failed search is
 * recorded as `TermSearchRun.error` with empty results — a failure is a value,
 * never an exception that aborts the stage.
 */
export async function searchTermCandidates(
  termCandidates: TermCandidates,
  options: TermSearchOptions,
): Promise<TermSearchRun[]> {
  const { country, resultsPerQuery } = options;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const seen = new Set<string>();

  const terms = [
    ...termCandidates.productNames.map((term) => ({
      term: term.trim(),
      kind: 'product' as const,
    })),
    ...termCandidates.categoryNames.map((term) => ({
      term: term.trim(),
      kind: 'category' as const,
    })),
  ].filter(({ term, kind }) => {
    if (!term) {
      return false;
    }

    const key = `${kind}:${term.toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  const providers = ['exa', 'deepseek'] as const;

  const jobs = terms.flatMap(({ term, kind }) =>
    providers.map((provider) => ({
      term,
      kind,
      provider,
    })),
  );

  const searchRuns: TermSearchRun[] = [];

  for (let index = 0; index < jobs.length; index += concurrency) {
    const batch = jobs.slice(index, index + concurrency);

    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.all(
      batch.map(async (job): Promise<TermSearchRun> => {
        const baseRun = {
          ...job,
          country,
          searchedAt: new Date().toISOString(),
        };

        try {
          let results: TermSearchResult[];

          if (job.provider === 'exa') {
            const response = await searchExa(
              job.term,
              resultsPerQuery,
              country,
            );

            results = response.results.map((result) => ({
              url: result.url,
              title: result.title,
              highlights: result.highlights,
              snippet: null,
              summary: null,
              content: null,
            }));
          } else {
            const response = await dsSearch(job.term, resultsPerQuery);

            results = response.results.map((result) => ({
              url: result.url,
              title: result.title,
              highlights: [],
              snippet: result.snippet,
              summary: result.summary,
              content: result.content || null,
            }));
          }

          return {
            ...baseRun,
            results,
          };
        } catch (error) {
          return {
            ...baseRun,
            results: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    searchRuns.push(...batchResults);
  }

  return searchRuns;
}
