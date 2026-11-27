import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { LeadQualificationController } from '../../src/modules/lead-qualification/lead-qualification.controller.js';
import type { LeadQualificationService } from '../../src/modules/lead-qualification/lead-qualification.service.js';

function controller(): {
  controller: LeadQualificationController;
  start: ReturnType<typeof vi.fn>;
  listResults: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn().mockResolvedValue({
    id: 'run-1',
    researchId: 'research-1',
    status: 'QUEUED',
  });
  const listResults = vi.fn().mockResolvedValue({
    items: [],
    nextCursor: null,
  });
  const fake = {
    start,
    listResults,
    getLatest: vi.fn(),
    getRun: vi.fn(),
    resume: vi.fn(),
    getResult: vi.fn(),
  };
  return {
    controller: new LeadQualificationController(
      fake as unknown as LeadQualificationService,
    ),
    start,
    listResults,
  };
}

describe('SDR-007A readonly result API', () => {
  it('defaults the listing to ACCEPTED', async () => {
    const setup = controller();
    await setup.controller.results('run-1', undefined, undefined, undefined, undefined, undefined, undefined);
    expect(setup.listResults).toHaveBeenCalledWith('run-1', {
      decision: 'ACCEPTED',
      reason: undefined,
      technicalFailure: undefined,
      q: undefined,
      cursor: undefined,
      limit: 50,
    });
  });

  it('supports explicit excluded and technical-failure filters', async () => {
    const setup = controller();
    await setup.controller.results(
      'run-1',
      'EXCLUDED',
      'PROCESSING_FAILED',
      'true',
      'alpha',
      'result-1',
      '25',
    );
    expect(setup.listResults).toHaveBeenCalledWith('run-1', {
      decision: 'EXCLUDED',
      reason: 'PROCESSING_FAILED',
      technicalFailure: true,
      q: 'alpha',
      cursor: 'result-1',
      limit: 25,
    });
  });

  it('rejects invalid decision and paging parameters', () => {
    const setup = controller();
    expect(() =>
      setup.controller.results('run-1', 'ALL', undefined, undefined, undefined, undefined, undefined),
    ).toThrow(BadRequestException);
    expect(() =>
      setup.controller.results('run-1', undefined, undefined, undefined, undefined, undefined, '0'),
    ).toThrow(BadRequestException);
  });

  it('passes an idempotency key only to the start operation', async () => {
    const setup = controller();
    await setup.controller.start('research-1', { idempotencyKey: 'request-1' });
    expect(setup.start).toHaveBeenCalledWith('research-1', {
      idempotencyKey: 'request-1',
    });
  });
});
