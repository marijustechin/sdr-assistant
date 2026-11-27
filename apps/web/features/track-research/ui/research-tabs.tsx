'use client';

import type { KeyboardEvent } from 'react';

import { RESEARCH_SECTIONS, type ResearchSection } from '../model/sections';

type ResearchTabsProps = {
  active: ResearchSection;
  onChange: (section: ResearchSection) => void;
  counts: Partial<Record<ResearchSection, number | null>>;
};

/**
 * Section navigation for one research.
 *
 * Communication is the read-only prepared-recipient queue. It contains no
 * sending controls or placeholder actions.
 */
export function ResearchTabs({ active, onChange, counts }: ResearchTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const currentIndex = tabs.findIndex(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    );

    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const section = RESEARCH_SECTIONS[nextIndex];

    if (section === undefined) {
      return;
    }

    event.preventDefault();
    tabs[nextIndex]?.focus();
    onChange(section.value);
  }

  return (
    <div className="research-tabs">
      <div
        className="research-tab-list"
        role="tablist"
        aria-label="Research sections"
        onKeyDown={handleKeyDown}
      >
        {RESEARCH_SECTIONS.map((section) => {
          const count = counts[section.value];

          return (
            <button
              key={section.value}
              type="button"
              role="tab"
              id={`research-tab-${section.value}`}
              aria-selected={active === section.value}
              aria-controls={`research-panel-${section.value}`}
              tabIndex={active === section.value ? 0 : -1}
              className="research-tab"
              onClick={() => onChange(section.value)}
            >
              {section.label}
              {typeof count === 'number' && (
                <span className="research-tab-count"> {count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
