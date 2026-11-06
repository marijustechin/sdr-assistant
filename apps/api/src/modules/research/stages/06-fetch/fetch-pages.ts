import { Logger } from '@nestjs/common';

import { scrapePage } from '../../lib/firecrawl-scrape.js';
import type { PageCandidate } from '../../types.js';

type PageFetchResult =
  | {
      status: 'succeeded';
      candidate: PageCandidate;
      document: Awaited<ReturnType<typeof scrapePage>>;
    }
  | {
      status: 'failed';
      candidate: PageCandidate;
      error: string;
    };

export async function fetchPages(
  pages: PageCandidate[],
): Promise<PageFetchResult[]> {
  const logger = new Logger('PageFetch');
  const results: PageFetchResult[] = [];

  for (const [index, candidate] of pages.entries()) {
    logger.log(`Fetching ${index + 1}/${pages.length}: ${candidate.url}`);

    try {
      // Intentionally sequential: one Firecrawl request at a time.
      // eslint-disable-next-line no-await-in-loop
      const document = await scrapePage(candidate.url);

      results.push({
        status: 'succeeded',
        candidate,
        document,
      });

      logger.log(
        `Fetched: ${candidate.url}, characters=${document.markdown.length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        status: 'failed',
        candidate,
        error: message,
      });

      logger.warn(`Fetch failed: ${candidate.url}: ${message}`);
    }
  }

  return results;
}
