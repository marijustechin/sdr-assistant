'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MAIN_NAV } from '../model/navigation';
import { NavIcon } from './nav-icon';
import { ThemeToggle } from './theme-toggle';

/**
 * Persistent left navigation. On narrow screens it becomes a horizontal top bar
 * (see `globals.css`), so no JavaScript menu state is needed.
 */
export function Sidebar() {
  const pathname = usePathname() ?? '/';

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="SDR Assistant — overview">
        <span className="brand-mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M13.4 2 5 13.2h5.4L10.6 22 19 10.8h-5.4z" />
          </svg>
        </span>
        <span className="brand-text">
          <span className="brand-name">SDR Assistant</span>
          <span className="brand-sub">Research workspace</span>
        </span>
      </Link>

      <nav className="nav" aria-label="Main">
        {MAIN_NAV.map((item) => {
          const isActive = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              aria-current={isActive ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <ThemeToggle />
        <div className="sidebar-footer">One product, one market per run.</div>
      </div>
    </aside>
  );
}
