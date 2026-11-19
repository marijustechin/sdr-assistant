/**
 * Browser-safe entry point for `entities/settings`.
 *
 * A Client Component imports this file, never the barrel: the barrel also
 * re-exports the `server-only` HTTP queries.
 */
export {
  describeSettingRange,
  readSettingInput,
  settingTypeSchema,
  toSettingInputValue,
} from './model/schema';
export type {
  SettingInput,
  SettingInputValue,
  SettingItem,
  SettingType,
  SettingsGroup,
  SettingsResponse,
} from './model/schema';
