import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { CreateResearchDto } from './dto/create-research.dto.js';
import { ResearchService } from './research.service.js';

@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post()
  @HttpCode(202)
  start(@Body() dto: CreateResearchDto) {
    return this.researchService.start(dto);
  }

  @Get(':jobId')
  getById(@Param('jobId') jobId: string) {
    return this.researchService.getById(jobId);
  }

  @Get()
  getAll() {
    return this.researchService.getAll();
  }
}
