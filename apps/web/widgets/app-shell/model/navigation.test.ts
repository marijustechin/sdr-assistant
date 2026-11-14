import { describe, expect, it } from 'vitest';

import {
  getSectionNav,
  isActiveHref,
  MAIN_NAV,
  type NavItem,
} from './navigation';

function activeLabels(pathname: string): string[] {
  return MAIN_NAV.filter((item: NavItem) => item.isActive(pathname)).map(
    (item) => item.label,
  );
}

describe('MAIN_NAV', () => {
  it('highlights exactly one top-level item per route', () => {
    expect(activeLabels('/')).toEqual(['Overview']);
    expect(activeLabels('/products')).toEqual(['Products']);
    expect(activeLabels('/products/new')).toEqual(['Products']);
    expect(activeLabels('/products/abc/edit')).toEqual(['Products']);
    expect(activeLabels('/researches')).toEqual(['Researches']);
    expect(activeLabels('/researches/job-1')).toEqual(['Researches']);
    expect(activeLabels('/health')).toEqual(['API health']);
  });

  it('does not match a section by a mere prefix of another route', () => {
    expect(activeLabels('/healthcheck')).toEqual([]);
    expect(activeLabels('/products-archive')).toEqual([]);
  });
});

describe('getSectionNav', () => {
  it('offers the product list tabs', () => {
    expect(getSectionNav('/products')).toEqual({
      label: 'Products',
      items: [
        { href: '/products', label: 'All products' },
        { href: '/products/new', label: 'New product' },
      ],
    });
  });

  it('marks the new-product page with the same tabs', () => {
    const section = getSectionNav('/products/new');
    expect(section?.items).toHaveLength(2);
  });

  it('offers overview/edit tabs inside a product', () => {
    const expected = [
      { href: '/products/abc', label: 'Overview' },
      { href: '/products/abc/edit', label: 'Edit' },
    ];

    expect(getSectionNav('/products/abc')?.items).toEqual(expected);
    expect(getSectionNav('/products/abc/edit')?.items).toEqual(expected);
  });

  it('decodes a product id in the generated hrefs', () => {
    expect(getSectionNav('/products/a%20b')?.items[0].href).toBe(
      '/products/a%20b',
    );
  });

  it('has no child navigation where there are no sibling pages', () => {
    expect(getSectionNav('/')).toBeNull();
    expect(getSectionNav('/researches')).toBeNull();
    expect(getSectionNav('/researches/job-1')).toBeNull();
    expect(getSectionNav('/health')).toBeNull();
  });
});

describe('isActiveHref', () => {
  it('treats a trailing slash as the same page', () => {
    expect(isActiveHref('/products', '/products')).toBe(true);
    expect(isActiveHref('/products', '/products/')).toBe(true);
    expect(isActiveHref('/products', '/products/new')).toBe(false);
  });
});
