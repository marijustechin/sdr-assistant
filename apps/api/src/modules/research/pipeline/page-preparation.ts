import type {
  PageForAssessment,
  TermSearchResult,
  TermSearchRun,
} from '../types.js';

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'yclid',
  'mc_cid',
  'mc_eid',
]);

/**
 * Grouping key for a page, not the site's canonical URL. Path case, language
 * segments and all meaningful query parameters are preserved.
 */
function canonicalizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';

    const keptParams = [...parsed.searchParams.entries()]
      .filter(([key]) => {
        const normalizedKey = key.toLowerCase();

        return (
          !normalizedKey.startsWith('utm_') &&
          !TRACKING_PARAMS.has(normalizedKey)
        );
      })
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        return (
          leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
        );
      });

    parsed.search = new URLSearchParams(keptParams).toString();

    return parsed.toString();
  } catch {
    return raw.trim();
  }
}

function domainOf(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return '';
  }
}

function addUniqueTexts(target: string[], values: string[]): void {
  for (const value of values) {
    if (value.trim() && !target.includes(value)) {
      target.push(value);
    }
  }
}

function pageFromResult(result: TermSearchResult): PageForAssessment {
  const page: PageForAssessment = {
    url: result.url,
    canonicalUrl: canonicalizeUrl(result.url),
    domain: domainOf(result.url),
    title: result.title?.trim() || null,
    highlights: [],
    snippets: [],
    summary: result.summary ?? null,
    content: result.content ?? null,
  };

  addUniqueTexts(page.highlights, result.highlights ?? []);

  if (result.snippet) {
    addUniqueTexts(page.snippets, [result.snippet]);
  }

  return page;
}

/**
 * Copy of a page with a recomputed grouping key and independent arrays, so
 * merging never mutates the caller's list.
 */
function normalizePage(page: PageForAssessment): PageForAssessment {
  return {
    ...page,
    canonicalUrl: canonicalizeUrl(page.url),
    domain: page.domain || domainOf(page.url),
    highlights: [...page.highlights],
    snippets: [...page.snippets],
  };
}

/**
 * Merges `source` into `target`. One definition of "the same page" for both
 * entry points, so search runs and page lists can never dedupe differently.
 */
function mergePageInto(
  target: PageForAssessment,
  source: PageForAssessment,
): void {
  addUniqueTexts(target.highlights, source.highlights);
  addUniqueTexts(target.snippets, source.snippets);

  if (source.title && source.title.trim().length > (target.title?.length ?? 0)) {
    target.title = source.title.trim();
  }

  if (source.summary && source.summary.length > (target.summary?.length ?? 0)) {
    target.summary = source.summary;
  }

  if (source.content && source.content.length > (target.content?.length ?? 0)) {
    target.content = source.content;
  }
}

function mergeIntoMap(
  pages: Map<string, PageForAssessment>,
  incoming: PageForAssessment,
): void {
  const existing = pages.get(incoming.canonicalUrl);

  if (existing) {
    mergePageInto(existing, incoming);
    return;
  }

  pages.set(incoming.canonicalUrl, incoming);
}

/**
 * Turns raw search runs into deduplicated pages: the same URL found by several
 * terms or providers becomes one page with combined text.
 */
export function preparePagesForAssessment(
  searchRuns: TermSearchRun[],
): PageForAssessment[] {
  const pages = new Map<string, PageForAssessment>();

  for (const run of searchRuns) {
    for (const result of run.results) {
      mergeIntoMap(pages, pageFromResult(result));
    }
  }

  return [...pages.values()];
}

/**
 * Union of page lists by canonical URL. The first occurrence wins for `url` and
 * `domain`; highlights and snippets are combined; the longest title, summary and
 * content survive.
 */
export function mergePages(
  ...lists: PageForAssessment[][]
): PageForAssessment[] {
  const pages = new Map<string, PageForAssessment>();

  for (const list of lists) {
    for (const page of list) {
      mergeIntoMap(pages, normalizePage(page));
    }
  }

  return [...pages.values()];
}
