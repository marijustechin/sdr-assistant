import type { NavIconName } from '../model/navigation';

type NavIconProps = {
  name: NavIconName;
  className?: string;
};

/**
 * The four navigation icons, inlined so the shell has no icon dependency.
 * Stroke-based, 24×24, inherits `currentColor`.
 */
export function NavIcon({ name, className = 'nav-icon' }: NavIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'overview' && (
        <path d="M4 10.7 12 4l8 6.7V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
      )}

      {name === 'products' && (
        <>
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
          <path d="M4 7.5 12 12l8-4.5" />
          <path d="M12 12v9" />
        </>
      )}

      {name === 'researches' && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l5 5" />
        </>
      )}

      {name === 'health' && <path d="M3 12h3.5l2.2-6 4.6 12 2.2-6H21" />}
    </svg>
  );
}
