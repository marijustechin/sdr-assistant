import type { PageCandidate, SiteGroup } from '../../types.js';

export function buildCrawlQueue(siteGroups: SiteGroup[]): PageCandidate[] {
  const queue: PageCandidate[] = [];

  const maxPagesPerSite = siteGroups.reduce(
    (max, group) => Math.max(max, group.pages.length),
    0,
  );

  for (let pageIndex = 0; pageIndex < maxPagesPerSite; pageIndex++) {
    for (const group of siteGroups) {
      const page = group.pages[pageIndex];

      if (page) {
        queue.push(page);
      }
    }
  }

  return queue;
}
