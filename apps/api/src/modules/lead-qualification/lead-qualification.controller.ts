import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { EXCLUSION_REASONS } from './lead-qualification.constants.js';
import { StartLeadQualificationDto } from './lead-qualification.dto.js';
import {
  LeadQualificationService,
  type ResultView,
  type RunView,
} from './lead-qualification.service.js';
import type {
  ExclusionReason,
  QualificationDecision,
} from './lead-qualification.types.js';

function parseDecision(value: string | undefined): QualificationDecision {
  if (value === undefined) return 'ACCEPTED';
  if (value === 'ACCEPTED' || value === 'EXCLUDED') return value;
  throw new BadRequestException('decision must be ACCEPTED or EXCLUDED.');
}

function parseReason(value: string | undefined): ExclusionReason | undefined {
  if (value === undefined) return undefined;
  if ((EXCLUSION_REASONS as readonly string[]).includes(value)) {
    return value as ExclusionReason;
  }
  throw new BadRequestException('Unknown exclusion reason.');
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new BadRequestException('technicalFailure must be true or false.');
}

function parseLimit(value: string | undefined): number {
  if (value === undefined) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestException('limit must be an integer between 1 and 100.');
  }
  return parsed;
}

@Controller()
export class LeadQualificationController {
  constructor(private readonly service: LeadQualificationService) {}

  @Post('research/:jobId/lead-qualification')
  @HttpCode(HttpStatus.ACCEPTED)
  start(
    @Param('jobId') jobId: string,
    @Body() dto: StartLeadQualificationDto,
  ): Promise<RunView> {
    return this.service.start(jobId, {
      idempotencyKey: dto?.idempotencyKey,
    });
  }

  @Get('research/:jobId/lead-qualification')
  latest(@Param('jobId') jobId: string): Promise<RunView> {
    return this.service.getLatest(jobId);
  }

  @Get('research/:jobId/lead-qualification/published')
  published(@Param('jobId') jobId: string): Promise<RunView> {
    return this.service.getPublished(jobId);
  }

  @Get('lead-qualification-runs/:runId')
  run(@Param('runId') runId: string): Promise<RunView> {
    return this.service.getRun(runId);
  }

  @Post('lead-qualification-runs/:runId/resume')
  @HttpCode(HttpStatus.ACCEPTED)
  resume(@Param('runId') runId: string): Promise<RunView> {
    return this.service.resume(runId);
  }

  @Get('lead-qualification-runs/:runId/results/:resultId')
  result(
    @Param('runId') runId: string,
    @Param('resultId') resultId: string,
  ): Promise<ResultView> {
    return this.service.getResult(runId, resultId);
  }

  @Get('lead-qualification-runs/:runId/results')
  results(
    @Param('runId') runId: string,
    @Query('decision') decision?: string,
    @Query('reason') reason?: string,
    @Query('technicalFailure') technicalFailure?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: ResultView[]; nextCursor: string | null }> {
    return this.service.listResults(runId, {
      decision: parseDecision(decision),
      reason: parseReason(reason),
      technicalFailure: parseBoolean(technicalFailure),
      q,
      cursor,
      limit: parseLimit(limit),
    });
  }
}
