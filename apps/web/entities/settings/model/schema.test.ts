import { describe, expect, it } from 'vitest';

import {
  describeSettingRange,
  readSettingInput,
  toSettingInputValue,
  type SettingItem,
} from './schema';

const INTEGER_KEY = 'research.pageCollection.resultsPerQuery';

function integerItem(overrides: Partial<SettingItem> = {}): SettingItem {
  return {
    key: INTEGER_KEY,
    label: 'Results per query',
    description: 'How many search results stage 02 requests per provider.',
    type: 'integer',
    value: 20,
    default: 20,
    min: 1,
    max: 50,
    ...overrides,
  };
}

describe('readSettingInput', () => {
  it('accepts an integer inside the metadata bounds', () => {
    expect(readSettingInput(integerItem(), '25')).toEqual({
      ok: true,
      value: 25,
    });
    expect(readSettingInput(integerItem(), '1').ok).toBe(true);
    expect(readSettingInput(integerItem(), '50').ok).toBe(true);
  });

  it('rejects a value below the minimum with the setting label', () => {
    expect(readSettingInput(integerItem(), '0')).toEqual({
      ok: false,
      message: 'Results per query must be at least 1.',
    });
  });

  it('rejects a value above the maximum', () => {
    expect(readSettingInput(integerItem(), '51')).toEqual({
      ok: false,
      message: 'Results per query must be at most 50.',
    });
  });

  it('rejects empty, fractional and non-numeric input', () => {
    expect(readSettingInput(integerItem(), '  ').ok).toBe(false);
    expect(readSettingInput(integerItem(), '1.5')).toEqual({
      ok: false,
      message: 'Results per query must be a whole number.',
    });
    expect(readSettingInput(integerItem(), 'many').ok).toBe(false);
  });

  it('validates string and boolean controls by type', () => {
    const text = integerItem({
      type: 'string',
      value: 'term',
      default: 'term',
      min: null,
      max: null,
    });
    expect(readSettingInput(text, '')).toEqual({
      ok: false,
      message: 'Results per query is required.',
    });
    expect(readSettingInput(text, 'sąrašas')).toEqual({
      ok: true,
      value: 'sąrašas',
    });

    const flag = integerItem({
      type: 'boolean',
      value: true,
      default: true,
      min: null,
      max: null,
    });
    expect(readSettingInput(flag, 'true')).toEqual({ ok: true, value: true });
    expect(readSettingInput(flag, 'false')).toEqual({ ok: true, value: false });
    expect(readSettingInput(flag, 'yes').ok).toBe(false);
  });
});

describe('setting metadata helpers', () => {
  it('renders stored values as controlled input strings', () => {
    expect(toSettingInputValue(integerItem({ value: 20 }))).toBe('20');
    expect(toSettingInputValue(integerItem({ value: 'abc' }))).toBe('abc');
    expect(toSettingInputValue(integerItem({ value: false }))).toBe('false');
  });

  it('describes closed, open and absent ranges', () => {
    expect(describeSettingRange(integerItem())).toBe('1–50');
    expect(describeSettingRange(integerItem({ max: null }))).toBe('at least 1');
    expect(describeSettingRange(integerItem({ min: null }))).toBe('at most 50');
    expect(describeSettingRange(integerItem({ min: null, max: null }))).toBe(
      null,
    );
  });
});
