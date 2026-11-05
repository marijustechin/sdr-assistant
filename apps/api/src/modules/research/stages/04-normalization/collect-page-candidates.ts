import { type PageCandidate, type SearchRun } from '../../types.js';

export function collectPageCandidates(
  searchRuns: SearchRun[],
): PageCandidate[] {
  const byUrl = new Map<string, PageCandidate>();

  for (const run of searchRuns) {
    const { results, ...search } = run;

    for (const result of results) {
      const parsedUrl = new URL(result.url);
      const url = parsedUrl.href;

      let candidate = byUrl.get(url);

      if (!candidate) {
        candidate = {
          url,
          hostname: parsedUrl.hostname,
          discoveries: [],
        };

        byUrl.set(url, candidate);
      }

      candidate.discoveries.push({
        search,
        result,
      });
    }
  }

  return [...byUrl.values()];
}
