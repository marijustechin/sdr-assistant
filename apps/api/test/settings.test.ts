import { describe, expect, it } from 'vitest'

import {
  SETTINGS,
  SETTINGS_BY_KEY,
  assertSettingsRegistry,
  validateSettingUpdates,
  type SettingDefinition,
} from '../src/modules/settings/settings.registry'
import { toSettingsResponse } from '../src/modules/settings/settings.mapper'

const INTEGER_KEY = 'research.pageCollection.resultsPerQuery'

function integerDefinition(): SettingDefinition {
  const definition = SETTINGS_BY_KEY.get(INTEGER_KEY)

  if (definition === undefined) {
    throw new Error(`Test setup: ${INTEGER_KEY} is not registered`)
  }

  return definition
}

describe('settings registry', () => {
  it('is internally consistent: defaults, bounds and namespacing', () => {
    expect(() => assertSettingsRegistry()).not.toThrow()

    for (const definition of SETTINGS) {
      expect(definition.key.startsWith(`${definition.group}.`)).toBe(true)
      expect(definition.schema.safeParse(definition.defaultValue).success).toBe(
        true,
      )

      if (typeof definition.defaultValue === 'number') {
        expect(definition.defaultValue).toBeGreaterThanOrEqual(
          definition.min ?? definition.defaultValue,
        )
        expect(definition.defaultValue).toBeLessThanOrEqual(
          definition.max ?? definition.defaultValue,
        )
      }
    }
  })

  it('rejects duplicate keys, unknown groups and defaults outside the schema', () => {
    const definition = integerDefinition()

    expect(() =>
      assertSettingsRegistry([definition, definition]),
    ).toThrow(/Duplicate setting key/)

    expect(() =>
      assertSettingsRegistry([{ ...definition, group: 'research.unknown' }]),
    ).toThrow(/unknown group/)

    expect(() =>
      assertSettingsRegistry([{ ...definition, defaultValue: 999 }]),
    ).toThrow(/default that fails its own schema|default above its maximum/)

    expect(() =>
      assertSettingsRegistry([{ ...definition, defaultValue: 'twenty' }]),
    ).toThrow(/default that fails its own schema/)

    expect(() =>
      assertSettingsRegistry([
        { ...definition, min: 50, max: 1, defaultValue: 20 },
      ]),
    ).toThrow(/min 50 greater than max 1/)
  })

  it('accepts both bounds and rejects values outside them', () => {
    const { schema } = integerDefinition()

    expect(schema.safeParse(1).success).toBe(true)
    expect(schema.safeParse(50).success).toBe(true)
    expect(schema.safeParse(0).success).toBe(false)
    expect(schema.safeParse(51).success).toBe(false)
    expect(schema.safeParse(1.5).success).toBe(false)
  })

  it('accepts a registered key with a valid value', () => {
    expect(validateSettingUpdates({ [INTEGER_KEY]: 25 })).toEqual({
      ok: true,
      updates: [{ key: INTEGER_KEY, value: 25 }],
    })
  })

  it('names an unknown key', () => {
    expect(validateSettingUpdates({ 'research.unknown.key': 1 })).toEqual({
      ok: false,
      errors: ['Unknown setting key: research.unknown.key'],
    })
  })

  it('names the key and the reason for an invalid value', () => {
    const result = validateSettingUpdates({ [INTEGER_KEY]: 'many' })

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain(INTEGER_KEY)
      expect(result.errors[0]).toContain('expected number')
    }
  })

  it('reports every failing key in one response', () => {
    const result = validateSettingUpdates({
      'research.unknown.key': true,
      [INTEGER_KEY]: 51,
    })

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toContain('research.unknown.key')
      expect(result.errors[1]).toContain(INTEGER_KEY)
    }
  })
})

describe('settings mapper', () => {
  it('uses the code default when nothing is stored', () => {
    const item = toSettingsResponse(new Map()).groups[0].items[0]

    expect(item.key).toBe(INTEGER_KEY)
    expect(item.value).toBe(20)
    expect(item.default).toBe(20)
    expect(item.min).toBe(1)
    expect(item.max).toBe(50)
  })

  it('prefers a stored value over the default', () => {
    const item = toSettingsResponse(new Map([[INTEGER_KEY, 30]])).groups[0]
      .items[0]

    expect(item.value).toBe(30)
    expect(item.default).toBe(20)
  })

  it('falls back to the default and reports a stored value that no longer validates', () => {
    const reported: string[] = []
    const item = toSettingsResponse(new Map([[INTEGER_KEY, 99]]), (definition) => {
      reported.push(definition.key)
    }).groups[0].items[0]

    expect(item.value).toBe(20)
    expect(reported).toEqual([INTEGER_KEY])
  })
})
