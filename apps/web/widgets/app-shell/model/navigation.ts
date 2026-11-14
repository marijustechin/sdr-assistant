export type NavIconName = 'overview' | 'products' | 'researches' | 'health';

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
    href: '/health',
    label: 'API health',
    icon: 'health',
    isActive: (pathname) => pathname === '/health',
  },
];

export type SectionTab = {
  href: string;
  label: string;
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

  return null;
}

/** `aria-current` helper: treats a trailing slash as the same page. */
export function isActiveHref(href: string, pathname: string): boolean {
  return pathname === href || pathname === `${href}/`;
}
