import { describe, expect, it } from 'vitest';

import { toHttpUrl } from './url';

describe('toHttpUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(toHttpUrl('https://example.test/products/bench')).toBe(
      'https://example.test/products/bench',
    );
    expect(toHttpUrl('http://example.test/offer')).toBe(
      'http://example.test/offer',
    );
    expect(toHttpUrl('  https://example.test/a  ')).toBe(
      'https://example.test/a',
    );
  });

  it('rejects non-HTTP protocols and executable schemes', () => {
    expect(toHttpUrl('javascript:alert(1)')).toBeNull();
    expect(toHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(toHttpUrl('ftp://example.test/file')).toBeNull();
    expect(toHttpUrl('mailto:sales@example.test')).toBeNull();
    expect(toHttpUrl('//example.test/protocol-relative')).toBeNull();
  });

  it('rejects empty, relative and malformed values', () => {
    expect(toHttpUrl(null)).toBeNull();
    expect(toHttpUrl(undefined)).toBeNull();
    expect(toHttpUrl('')).toBeNull();
    expect(toHttpUrl('   ')).toBeNull();
    expect(toHttpUrl('/relative/path')).toBeNull();
    expect(toHttpUrl('not a url')).toBeNull();
  });
});
