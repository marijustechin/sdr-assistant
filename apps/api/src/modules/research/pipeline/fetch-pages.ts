import { fetchExaContents } from '../lib/exa-contents.js';
import type { PageForAssessment } from '../types.js';

export type PageContentFetch = {
  page: PageForAssessment;
  fetched: boolean;
  error?: string;
};

const DEFAULT_CONCURRENCY = 4;

function needsFetch(page: PageForAssessment): boolean {
  return (page.content ?? '').trim().length === 0;
}

/**
 * Fills in page text where there is none, using Exa's contents endpoint.
 *
 * Only pages without any content are fetched; every other page is returned
 * unchanged. A failed fetch is a value on that page, never an exception that
 * aborts the stage, and the page keeps whatever text it already had.
 */
export async function fetchMissingPageContent(
  pages: PageForAssessment[],
  options: { concurrency?: number } = {},
): Promise<PageContentFetch[]> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const results: PageContentFetch[] = pages.map((page) => ({
    page,
    fetched: false,
  }));

  const pending = pages
    .map((page, index) => (needsFetch(page) ? index : -1))
    .filter((index) => index >= 0);

  for (let offset = 0; offset < pending.length; offset += concurrency) {
    const batch = pending.slice(offset, offset + concurrency);

    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.all(
      batch.map(async (index): Promise<PageContentFetch> => {
        const page = pages[index];

        try {
          const fetched = await fetchExaContents(page.url);

          if (!fetched.text) {
            return { page, fetched: false, error: 'no text returned' };
          }

          return {
            page: {
              ...page,
              title: page.title ?? fetched.title,
              content: fetched.text,
            },
            fetched: true,
          };
        } catch (error) {
          return {
            page,
            fetched: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    for (let index = 0; index < batch.length; index += 1) {
      results[batch[index]] = batchResults[index];
    }
  }

  return results;
}
