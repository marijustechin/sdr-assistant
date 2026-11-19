import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  toSettingsResponse,
  type SettingsResponse,
} from './settings.mapper.js';
import {
  SETTINGS_BY_KEY,
  type SettingValue,
  validateSettingUpdates,
} from './settings.registry.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Code defaults overlaid with the values stored in `settings`. */
  async getSettings(): Promise<SettingsResponse> {
    const rows = await this.prisma.setting.findMany();
    const stored = new Map<string, unknown>(
      rows.map((row) => [row.key, row.value]),
    );

    return toSettingsResponse(stored, (definition, value) => {
      this.logger.warn(
        `Stored value for ${definition.key} is invalid; using the default. Value: ${JSON.stringify(
          value,
        )}`,
      );
    });
  }

  /**
   * Validates every key against the registry, then upserts the whole batch in
   * one transaction. Nothing is written when any key is unknown or invalid.
   */
  async updateSettings(
    updates: Record<string, unknown>,
  ): Promise<SettingsResponse> {
    const validation = validateSettingUpdates(updates);

    if (!validation.ok) {
      throw new BadRequestException({
        statusCode: 400,
        message: validation.errors,
        error: 'Bad Request',
      });
    }

    if (validation.updates.length > 0) {
      await this.prisma.$transaction(
        validation.updates.map(({ key, value }) =>
          this.prisma.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          }),
        ),
      );
    }

    return this.getSettings();
  }

  /**
   *
   * @param key
   * @returns
   */
  async getNumber(key: string): Promise<number> {
    const value = await this.readValue(key);

    if (typeof value !== 'number') {
      throw new TypeError(`Setting ${key} is not a number`);
    }

    return value;
  }

  /**
   *
   * @param key
   * @returns
   */
  private async readValue(key: string): Promise<SettingValue> {
    const definition = SETTINGS_BY_KEY.get(key);

    if (definition === undefined) {
      throw new Error(`Unknown setting key: ${key}`);
    }

    const row = await this.prisma.setting.findUnique({ where: { key } });
    const parsed = definition.schema.safeParse(
      row?.value ?? definition.defaultValue,
    );

    return parsed.success ? parsed.data : definition.defaultValue;
  }
}
