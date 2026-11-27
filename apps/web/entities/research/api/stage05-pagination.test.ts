import { describe, expect, it } from 'vitest';

import { collectResultPages } from './stage05-pagination';

function page(ids: string[], nextCursor: string | null) {
  return {
    items: ids.map((id) => ({ id })),
    nextCursor,
  };
}

describe('Stage 05 result cursor pagination', () => {
  it('reads more than 100 results across API pages', async () => {
    const all = Array.from({ length: 150 }, (_, index) => `result-${index}`);
    const cursors: Array<string | null> = [];
    const items = await collectResultPages(async (cursor) => {
      cursors.push(cursor);
      if (cursor === null) return page(all.slice(0, 100), 'cursor-2');
      if (cursor === 'cursor-2') return page(all.slice(100), null);
      throw new Error('unexpected cursor');
    });

    expect(items).toHaveLength(150);
    expect(items[0]?.id).toBe('result-0');
    expect(items[149]?.id).toBe('result-149');
    expect(cursors).toEqual([null, 'cursor-2']);
  });

  it('rejects a repeated cursor instead of looping forever', async () => {
    await expect(
      collectResultPages(async (cursor) => {
        if (cursor === null) return page(['a'], 'same-cursor');
        return page(['b'], 'same-cursor');
      }),
    ).rejects.toThrow('repeated a cursor');
  });

  it('deduplicates result rows repeated across pages', async () => {
    const items = await collectResultPages(async (cursor) => {
      if (cursor === null) return page(['a', 'b'], 'next');
      return page(['b', 'c'], null);
    });

    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});
