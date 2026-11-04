import { Body, Controller, HttpCode, Post } from '@nestjs/common'

import { CreateResearchDto } from './dto/create-research.dto.js'
import { ResearchService } from './research.service.js'

@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post()
  @HttpCode(200)
  start(@Body() dto: CreateResearchDto) {
    return this.researchService.start(dto)
  }
}
