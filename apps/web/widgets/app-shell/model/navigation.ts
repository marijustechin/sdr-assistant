export type NavIconName =
  'overview' | 'products' | 'researches' | 'settings' | 'health';

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  isActive: (pathname: string) => boolean;
};

export const MAIN_NAV: readonly NavItem[] = [
  {
    href: '/',
    label: 'Overview',
    icon: 'overview',
    isActive: (pathname) => pathname === '/',
  },
  {
    href: '/products',
    label: 'Products',
    icon: 'products',
    isActive: (pathname) =>
      pathname === '/products' || pathname.startsWith('/products/'),
  },
  {
    href: '/researches',
    label: 'Researches',
    icon: 'researches',
    isActive: (pathname) =>
      pathname === '/researches' || pathname.startsWith('/researches/'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: 'settings',
    isActive: (pathname) =>
      pathname === '/settings' || pathname.startsWith('/settings/'),
  },
  {
    href: '/health',
    label: 'API health',
    icon: 'health',
    isActive: (pathname) => pathname === '/health',
  },
];

export type SectionTab = {
  href: string;
  label: string;
  /** Optional matcher for nested pages that belong to the same tab. */
  isActive?: (pathname: string) => boolean;
};

export type SectionNav = {
  /** Used as the navigation landmark's accessible name. */
  label: string;
  items: readonly SectionTab[];
};

function productTabs(id: string): readonly SectionTab[] {
  const href = `/products/${encodeURIComponent(id)}`;

  return [
    { href, label: 'Overview' },
    { href: `${href}/edit`, label: 'Edit' },
  ];
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Secondary, horizontal navigation for one section. Returns `null` for routes
 * that have no sibling pages worth switching between.
 */
export function getSectionNav(pathname: string): SectionNav | null {
  if (pathname === '/products' || pathname === '/products/new') {
    return {
      label: 'Products',
      items: [
        { href: '/products', label: 'All products' },
        { href: '/products/new', label: 'New product' },
      ],
    };
  }

  const productRoute = /^\/products\/([^/]+)(?:\/edit)?\/?$/.exec(pathname);

  if (productRoute !== null) {
    const id = safeDecode(productRoute[1]);

    return { label: 'Product', items: productTabs(id) };
  }

  if (
    /^\/settings(?:\/research|\/email-accounts(?:\/new|\/[^/]+\/edit)?)?\/?$/.test(
      pathname,
    )
  ) {
    return {
      label: 'Settings',
      items: [
        { href: '/settings', label: 'Overview' },
        { href: '/settings/research', label: 'Research' },
        {
          href: '/settings/email-accounts',
          label: 'Email accounts',
          isActive: (current) =>
            current === '/settings/email-accounts' ||
            current.startsWith('/settings/email-accounts/'),
        },
      ],
    };
  }

  return null;
}

/** `aria-current` helper: treats a trailing slash as the same page. */
export function isActiveHref(href: string, pathname: string): boolean {
  return pathname === href || pathname === `${href}/`;
}
