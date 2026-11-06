import type { PageCandidate } from '../../types.js';

export function prepareCrawlExecution(
  queue: PageCandidate[],
  maxPages: number,
): {
  selected: PageCandidate[];
  deferred: PageCandidate[];
} {
  const byDirection = new Map<string, PageCandidate[]>();

  for (const page of queue) {
    const directions = new Set(
      page.discoveries.map((discovery) => discovery.search.task.direction),
    );

    for (const direction of directions) {
      let pages = byDirection.get(direction);

      if (!pages) {
        pages = [];
        byDirection.set(direction, pages);
      }

      pages.push(page);
    }
  }

  const selected: PageCandidate[] = [];
  const selectedUrls = new Set<string>();

  while (selected.length < maxPages) {
    let added = false;

    for (const pages of byDirection.values()) {
      const page = pages.find((item) => !selectedUrls.has(item.url));

      if (!page) {
        continue;
      }

      selected.push(page);
      selectedUrls.add(page.url);
      added = true;

      if (selected.length >= maxPages) {
        break;
      }
    }

    if (!added) {
      break;
    }
  }

  return {
    selected,
    deferred: queue.filter((page) => !selectedUrls.has(page.url)),
  };
}
