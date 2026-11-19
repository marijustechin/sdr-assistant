import 'server-only';

import { getJson, patchJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

import { settingsResponseSchema, type SettingsResponse } from '../model/schema';

export function fetchSettings(): Promise<ApiResult<SettingsResponse>> {
  return getJson(`${apiUrl}/settings`, settingsResponseSchema);
}

export function updateSettings(
  updates: Record<string, unknown>,
): Promise<ApiResult<SettingsResponse>> {
  return patchJson(`${apiUrl}/settings`, { updates }, settingsResponseSchema);
}
