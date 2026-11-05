import type { PageCandidate, SiteGroup } from '../../types.js';

export function groupPagesBySite(pages: PageCandidate[]): SiteGroup[] {
  const groups = new Map<string, SiteGroup>();

  for (const page of pages) {
    let group = groups.get(page.hostname);

    if (!group) {
      group = {
        hostname: page.hostname,
        pages: [],
      };

      groups.set(page.hostname, group);
    }

    group.pages.push(page);
  }

  return [...groups.values()];
}
