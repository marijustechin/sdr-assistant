import { describe, expect, it } from 'vitest';

import { parseTestRecipient } from './test-email';

describe('parseTestRecipient', () => {
  it('trims and accepts a valid recipient', () => {
    expect(parseTestRecipient('  test+label@example.test  ')).toEqual({
      ok: true,
      recipient: 'test+label@example.test',
    });
  });

  it.each([
    ['', 'Enter a test recipient email address.'],
    ['   ', 'Enter a test recipient email address.'],
    ['not-an-email', 'Enter a valid email address.'],
    ['test@', 'Enter a valid email address.'],
    ['@example.test', 'Enter a valid email address.'],
    [
      `${'x'.repeat(310)}@example.test`,
      'The test recipient must be 320 characters or fewer.',
    ],
  ])('rejects %j', (value, message) => {
    expect(parseTestRecipient(value)).toEqual({ ok: false, message });
  });
});
