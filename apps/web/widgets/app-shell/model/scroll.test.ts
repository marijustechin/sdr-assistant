import { describe, expect, it } from 'vitest';

import { shouldShowBackToTop } from './scroll';

const viewportHeight = 800;

describe('shouldShowBackToTop', () => {
  it('stays hidden on a page that fits the screen', () => {
    expect(
      shouldShowBackToTop({
        scrollY: 0,
        viewportHeight,
        documentHeight: 900,
      }),
    ).toBe(false);
  });

  it('stays hidden near the top of a long page', () => {
    expect(
      shouldShowBackToTop({
        scrollY: 200,
        viewportHeight,
        documentHeight: 4_000,
      }),
    ).toBe(false);
  });

  it('appears once a long page is scrolled past the threshold', () => {
    expect(
      shouldShowBackToTop({
        scrollY: 900,
        viewportHeight,
        documentHeight: 4_000,
      }),
    ).toBe(true);
  });

  it('requires a real overflow, not just any scrolling', () => {
    expect(
      shouldShowBackToTop({
        scrollY: 900,
        viewportHeight,
        documentHeight: viewportHeight + 150,
      }),
    ).toBe(false);
  });
});
