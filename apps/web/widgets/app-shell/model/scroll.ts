/** A page must be at least this much taller than the viewport to get the button. */
export const BACK_TO_TOP_MIN_OVERFLOW = 200;

/** The button appears only after the page has been scrolled this far. */
export const BACK_TO_TOP_THRESHOLD = 400;

export type ScrollMetrics = {
  scrollY: number;
  viewportHeight: number;
  documentHeight: number;
};

/**
 * The button is only useful on pages that do not fit the screen, so a long page
 * scrolled back to the top does not show it, and a short page never does.
 */
export function shouldShowBackToTop({
  scrollY,
  viewportHeight,
  documentHeight,
}: ScrollMetrics): boolean {
  const overflows = documentHeight > viewportHeight + BACK_TO_TOP_MIN_OVERFLOW;

  return overflows && scrollY > BACK_TO_TOP_THRESHOLD;
}
