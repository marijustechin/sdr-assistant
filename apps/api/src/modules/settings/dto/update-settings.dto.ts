import { IsObject } from 'class-validator'

export class UpdateSettingsDto {
  /**
   * Setting key → new value. Keys and values are validated against the typed
   * registry in `SettingsService`; `unknown` here is intentional because the
   * registry, not the DTO, owns what each key accepts.
   */
  @IsObject()
  updates!: Record<string, unknown>
}
