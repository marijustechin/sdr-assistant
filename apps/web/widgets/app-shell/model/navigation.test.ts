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
    expect(activeLabels('/settings')).toEqual(['Settings']);
    expect(activeLabels('/settings/research')).toEqual(['Settings']);
    expect(activeLabels('/health')).toEqual(['API health']);
  });

  it('does not match a section by a mere prefix of another route', () => {
    expect(activeLabels('/healthcheck')).toEqual([]);
    expect(activeLabels('/products-archive')).toEqual([]);
    expect(activeLabels('/settings-archive')).toEqual([]);
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

  it('offers overview/research/email-account tabs inside settings', () => {
    const expected = [
      { href: '/settings', label: 'Overview' },
      { href: '/settings/research', label: 'Research' },
      { href: '/settings/email-accounts', label: 'Email accounts' },
    ];

    for (const pathname of [
      '/settings',
      '/settings/research',
      '/settings/email-accounts',
      '/settings/email-accounts/new',
      '/settings/email-accounts/account-1/edit',
    ]) {
      expect(
        getSectionNav(pathname)?.items.map(({ href, label }) => ({
          href,
          label,
        })),
      ).toEqual(expected);
    }
  });

  it('marks the email-account tab current on its nested pages', () => {
    const items = getSectionNav(
      '/settings/email-accounts/account-1/edit',
    )?.items;
    const emailAccounts = items?.find(
      (item) => item.href === '/settings/email-accounts',
    );

    expect(emailAccounts?.isActive?.('/settings/email-accounts')).toBe(true);
    expect(emailAccounts?.isActive?.('/settings/email-accounts/new')).toBe(
      true,
    );
    expect(emailAccounts?.isActive?.('/settings')).toBe(false);
    expect(emailAccounts?.isActive?.('/settings/research')).toBe(false);
  });

  it('has no child navigation where there are no sibling pages', () => {
    expect(getSectionNav('/')).toBeNull();
    expect(getSectionNav('/researches')).toBeNull();
    expect(getSectionNav('/researches/job-1')).toBeNull();
    expect(getSectionNav('/settings/unknown')).toBeNull();
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
