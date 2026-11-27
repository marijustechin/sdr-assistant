export type ResultPage<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * Reads every page of a cursor-paginated result list.
 *
 * The API limits one response to 100 rows. The Contacts view needs the full
 * accepted/excluded sets for its counts and local search, so this helper keeps
 * following `nextCursor` while guarding against repeated cursors and duplicate
 * result ids.
 */
export async function collectResultPages<T extends { id: string }>(
  fetchPage: (cursor: string | null) => Promise<ResultPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      items.push(item);
    }

    if (page.nextCursor === null || page.nextCursor === '') {
      return items;
    }
    if (seenCursors.has(page.nextCursor)) {
      throw new Error('Stage 05 result pagination repeated a cursor.');
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
