import {
  SETTING_GROUPS,
  SETTINGS,
  type SettingDefinition,
  type SettingType,
  type SettingValue,
} from './settings.registry.js'

export type SettingItem = {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly type: SettingType
  readonly value: SettingValue
  readonly default: SettingValue
  readonly min: number | null
  readonly max: number | null
}

export type SettingsGroup = {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly items: SettingItem[]
}

/** `GET /settings` and `PATCH /settings` response. */
export type SettingsResponse = {
  readonly groups: SettingsGroup[]
}

export type StoredSettingValues = ReadonlyMap<string, unknown>

export type InvalidStoredValueHandler = (
  definition: SettingDefinition,
  stored: unknown,
) => void

/**
 * Builds the grouped response: the code registry decides the groups, labels,
 * order and metadata; the DB only supplies values. Precedence is default,
 * then DB value. A stored value that no longer fits its schema falls back to
 * the default and is reported through `onInvalidStoredValue`.
 */
export function toSettingsResponse(
  stored: StoredSettingValues,
  onInvalidStoredValue?: InvalidStoredValueHandler,
): SettingsResponse {
  const groups: SettingsGroup[] = SETTING_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    description: group.description,
    items: [],
  }))
  const groupsByKey = new Map(groups.map((group) => [group.key, group]))

  for (const definition of SETTINGS) {
    const group = groupsByKey.get(definition.group)

    if (group === undefined) {
      // assertSettingsRegistry() runs at import time; this is a guard for a
      // definition added between the two.
      throw new Error(
        `Setting ${definition.key} references unknown group ${definition.group}`,
      )
    }

    group.items.push(
      toSettingItem(
        definition,
        stored.get(definition.key),
        onInvalidStoredValue,
      ),
    )
  }

  return { groups }
}

function toSettingItem(
  definition: SettingDefinition,
  stored: unknown,
  onInvalidStoredValue?: InvalidStoredValueHandler,
): SettingItem {
  let value = definition.defaultValue

  if (stored !== undefined) {
    const parsed = definition.schema.safeParse(stored)

    if (parsed.success) {
      value = parsed.data
    } else {
      onInvalidStoredValue?.(definition, stored)
    }
  }

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    type: definition.type,
    value,
    default: definition.defaultValue,
    min: definition.min,
    max: definition.max,
  }
}
