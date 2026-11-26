'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getSectionNav, isActiveHref } from '../model/navigation';

/**
 * Horizontal child navigation for a section. Renders nothing when the current
 * route has no sibling pages.
 */
export function SectionNav() {
  const pathname = usePathname() ?? '/';
  const section = getSectionNav(pathname);

  if (section === null) {
    return null;
  }

  return (
    <nav className="section-nav" aria-label={section.label}>
      <div className="section-nav-inner">
        {section.items.map((item) => {
          const isActive =
            item.isActive === undefined
              ? isActiveHref(item.href, pathname)
              : item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="section-tab"
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
