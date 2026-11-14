'use client';

import { useCallback, useEffect, useState } from 'react';

import { shouldShowBackToTop } from '../model/scroll';

/**
 * Appears only on pages that are actually taller than the screen, once the user
 * has scrolled down. Mounted once in the root layout, so every page gets it.
 */
export function ToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    function update(): void {
      frame = 0;
      setIsVisible(
        shouldShowBackToTop({
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
        }),
      );
    }

    function requestUpdate(): void {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    }

    frame = window.requestAnimationFrame(update);
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  const scrollToTop = useCallback(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      className="to-top"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      </svg>
    </button>
  );
}
