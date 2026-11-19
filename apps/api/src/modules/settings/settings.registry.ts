import { z } from 'zod'

/**
 * Every setting the API exposes. A setting lives in exactly one place — this
 * file — and carries its own validation schema, default and metadata.
 *
 * Adding a setting: append one entry to `SETTINGS`. If it belongs to a new
 * area, add the group to `SETTING_GROUPS` too. No migration is needed: the
 * `settings` table stores arbitrary JSON values keyed by `key`.
 */

export const SETTING_TYPES = ['integer', 'string', 'boolean'] as const

export type SettingType = (typeof SETTING_TYPES)[number]

/** JSON primitives the current registry supports. */
export type SettingValue = string | number | boolean

export type SettingDefinition = {
  /** Namespaced, stable identifier; also the primary key in `settings`. */
  readonly key: string
  /** Key of the group this setting is rendered under. */
  readonly group: string
  readonly label: string
  readonly description: string
  readonly type: SettingType
  /** Validates a stored or submitted value. */
  readonly schema: z.ZodType<SettingValue>
  readonly defaultValue: SettingValue
  /** Inclusive bounds; `null` when the type has no meaningful range. */
  readonly min: number | null
  readonly max: number | null
}

export type SettingGroupDefinition = {
  readonly key: string
  readonly label: string
  readonly description: string
}

export const SETTING_GROUPS: readonly SettingGroupDefinition[] = [
  {
    key: 'research.pageCollection',
    label: 'Page collection',
    description:
      'Search and triage behaviour of stage 02 for new research runs.',
  },
]

type IntegerSettingInput = {
  readonly key: string
  readonly group: string
  readonly label: string
  readonly description: string
  readonly defaultValue: number
  readonly min: number
  readonly max: number
}

/** Builds the zod schema and the bounds metadata from one declaration. */
function integerSetting(input: IntegerSettingInput): SettingDefinition {
  return {
    key: input.key,
    group: input.group,
    label: input.label,
    description: input.description,
    type: 'integer',
    schema: z.number().int().min(input.min).max(input.max),
    defaultValue: input.defaultValue,
    min: input.min,
    max: input.max,
  }
}

export const SETTINGS: readonly SettingDefinition[] = [
  integerSetting({
    key: 'research.pageCollection.resultsPerQuery',
    group: 'research.pageCollection',
    label: 'Results per query',
    description:
      'How many search results stage 02 requests per query per provider.',
    defaultValue: 20,
    min: 1,
    max: 50,
    // TODO(settings wiring): stage 02 still passes the literal `resultsPerQuery:
    // 20` in its commented-out live search
    // (stages/02-page-collection/page-collection.service.ts). Inject this value
    // there when that path is re-enabled; no current run reads the setting yet.
  }),
]

export const SETTINGS_BY_KEY: ReadonlyMap<string, SettingDefinition> = new Map(
  SETTINGS.map((definition) => [definition.key, definition]),
)

export type SettingUpdate = {
  readonly key: string
  readonly value: SettingValue
}

export type SettingUpdateValidation =
  | { readonly ok: true; readonly updates: readonly SettingUpdate[] }
  | { readonly ok: false; readonly errors: readonly string[] }

/**
 * Validates a whole `PATCH /settings` payload against the registry.
 *
 * Unknown keys and invalid values are reported together, each message naming
 * the failing key, so one round trip is enough to fix several fields.
 */
export function validateSettingUpdates(
  updates: Record<string, unknown>,
): SettingUpdateValidation {
  const errors: string[] = []
  const valid: SettingUpdate[] = []

  for (const [key, value] of Object.entries(updates)) {
    const definition = SETTINGS_BY_KEY.get(key)

    if (definition === undefined) {
      errors.push(`Unknown setting key: ${key}`)
      continue
    }

    const parsed = definition.schema.safeParse(value)

    if (!parsed.success) {
      const reason = parsed.error.issues[0]?.message ?? 'invalid value'
      errors.push(`Invalid value for ${key}: ${reason}`)
      continue
    }

    valid.push({ key, value: parsed.data })
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, updates: valid }
}

/**
 * Fail-fast integrity check, run when the module is loaded. Tests call it with
 * deliberately broken definitions as well.
 */
export function assertSettingsRegistry(
  definitions: readonly SettingDefinition[] = SETTINGS,
  groups: readonly SettingGroupDefinition[] = SETTING_GROUPS,
): void {
  const groupKeys = new Set(groups.map((group) => group.key))
  const seenKeys = new Set<string>()

  for (const definition of definitions) {
    if (seenKeys.has(definition.key)) {
      throw new Error(`Duplicate setting key: ${definition.key}`)
    }

    seenKeys.add(definition.key)

    if (!groupKeys.has(definition.group)) {
      throw new Error(
        `Setting ${definition.key} references unknown group ${definition.group}`,
      )
    }

    if (!definition.key.startsWith(`${definition.group}.`)) {
      throw new Error(
        `Setting ${definition.key} must be namespaced under ${definition.group}.`,
      )
    }

    if (
      definition.min !== null &&
      definition.max !== null &&
      definition.min > definition.max
    ) {
      throw new Error(
        `Setting ${definition.key} has min ${definition.min} greater than max ${definition.max}.`,
      )
    }

    if (!definition.schema.safeParse(definition.defaultValue).success) {
      throw new Error(
        `Setting ${definition.key} has a default that fails its own schema.`,
      )
    }

    if (typeof definition.defaultValue === 'number') {
      if (
        definition.min !== null &&
        definition.defaultValue < definition.min
      ) {
        throw new Error(
          `Setting ${definition.key} has a default below its minimum.`,
        )
      }

      if (
        definition.max !== null &&
        definition.defaultValue > definition.max
      ) {
        throw new Error(
          `Setting ${definition.key} has a default above its maximum.`,
        )
      }
    }
  }
}

assertSettingsRegistry()
