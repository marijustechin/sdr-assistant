import { Body, Controller, Get, Patch } from '@nestjs/common'

import { UpdateSettingsDto } from './dto/update-settings.dto.js'
import { SettingsService } from './settings.service.js'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.getSettings()
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto.updates)
  }
}
