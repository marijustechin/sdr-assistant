import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { ContactDiscoveryAutomationService, STAGE05_PENDING_STAGE } from '../src/modules/contact-discovery-pipeline/contact-discovery.automation.js';
import type { ContactDiscoveryRuntime } from '../src/modules/contact-discovery-pipeline/contact-discovery.runtime.js';

function automation(
  start: ReturnType<typeof vi.fn>,
  execute: ReturnType<typeof vi.fn>,
  prisma?: unknown,
) {
  return new ContactDiscoveryAutomationService(
    { start, execute } as unknown as ContactDiscoveryRuntime,
    prisma as PrismaService | undefined,
  );
}

function run(id: string, status: string) {
  return {
    id,
    researchId: 'research-1',
    status,
    trigger: 'AUTO',
    targetCountry: 'Lithuania',
    qualificationVersion: 'contact-discovery-v1',
    policyVersion: 'contact-discovery-v1',
    promptVersion: null,
    inputFingerprint: 'fingerprint',
    companyCount: 3,
    processedCount: 0,
    acceptedCount: 0,
    excludedCount: 0,
    technicalFailureCount: 0,
    usage: {},
    startedAt: null,
    completedAt: null,
    publishedAt: null,
    supersededAt: null,
    error: null,
  };
}

describe('automatic Stage 05 orchestration', () => {
  it('starts one idempotent automatic run and executes it', async () => {
    const start = vi.fn(async () => run('run-1', 'QUEUED'));
    const execute = vi.fn(async () => run('run-1', 'COMPLETED'));
    const service = automation(start, execute);

    await service.afterStage04Completed('research-1');
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    expect(start).toHaveBeenCalledWith('research-1', {
      trigger: 'AUTO',
      autoStart: false,
      idempotencyKey: 'stage05:contact-discovery-v1:research-1',
    });
    expect(execute).toHaveBeenCalledWith('run-1');
  });

  it('does not execute a duplicate completion event twice', async () => {
    let completed = false;
    const start = vi.fn(async () => run('run-1', completed ? 'COMPLETED' : 'QUEUED'));
    const execute = vi.fn(async () => {
      completed = true;
      return run('run-1', 'COMPLETED');
    });
    const service = automation(start, execute);

    await service.afterStage04Completed('research-1');
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    await service.afterStage04Completed('research-1');

    expect(start).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1]).toMatchObject({
      idempotencyKey: 'stage05:contact-discovery-v1:research-1',
    });
    expect(start.mock.calls[1][1]).toMatchObject({
      idempotencyKey: 'stage05:contact-discovery-v1:research-1',
    });
  });

  it('does not execute a failed automatic run again', async () => {
    const start = vi.fn(async () => run('run-1', 'FAILED'));
    const execute = vi.fn(async () => run('run-1', 'COMPLETED'));
    const service = automation(start, execute);

    await service.afterStage04Completed('research-1');
    expect(execute).not.toHaveBeenCalled();
  });

  it('recovers queued/interrupted automatic runs but not active or manual runs', async () => {
    const findMany = vi.fn(async () => [
      { id: 'queued', status: 'QUEUED', executionLeaseUntil: null },
      { id: 'interrupted', status: 'INTERRUPTED', executionLeaseUntil: null },
      {
        id: 'active',
        status: 'RUNNING',
        executionLeaseUntil: new Date(Date.now() + 60_000),
      },
      {
        id: 'expired',
        status: 'RUNNING',
        executionLeaseUntil: new Date(Date.now() - 1_000),
      },
    ]);
    const execute = vi.fn(async () => run('queued', 'COMPLETED'));
    const service = automation(
      vi.fn(),
      execute,
      {
        research: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
        leadQualificationRun: { findMany },
      },
    );

    await service.onModuleInit();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trigger: 'AUTO',
          qualificationVersion: 'contact-discovery-v1',
          status: { in: ['QUEUED', 'RUNNING', 'INTERRUPTED'] },
        },
      }),
    );
    expect(execute.mock.calls.map((call) => call[0])).toEqual([
      'queued',
      'interrupted',
      'expired',
    ]);
  });

  it('clears the pending marker only after start returns a durable run', async () => {
    const events: string[] = [];
    const start = vi.fn(async () => {
      events.push('start');
      return run('run-1', 'QUEUED');
    });
    const updateMany = vi.fn(async () => {
      events.push('clear');
      return { count: 1 };
    });
    const service = automation(
      start,
      vi.fn(async () => run('run-1', 'COMPLETED')),
      {
        research: { findMany: vi.fn(async () => []), updateMany },
      },
    );

    await service.afterStage04Completed('research-1');

    expect(events).toEqual(['start', 'clear']);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'research-1',
        status: 'COMPLETED',
        stage: STAGE05_PENDING_STAGE,
      },
      data: { stage: null },
    });
  });

  it('recovers a completed research that still has the pending marker', async () => {
    const researchFindMany = vi.fn(async () => [{ id: 'research-pending' }]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const start = vi.fn(async () => run('run-pending', 'QUEUED'));
    const execute = vi.fn(async () => run('run-pending', 'COMPLETED'));
    const service = automation(start, execute, {
      research: { findMany: researchFindMany, updateMany },
      leadQualificationRun: { findMany: vi.fn(async () => []) },
    });

    await service.onModuleInit();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    expect(researchFindMany).toHaveBeenCalledWith({
      where: { status: 'COMPLETED', stage: STAGE05_PENDING_STAGE },
      select: { id: true },
    });
    expect(start).toHaveBeenCalledWith(
      'research-pending',
      expect.objectContaining({
        idempotencyKey: 'stage05:contact-discovery-v1:research-pending',
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'research-pending' }),
        data: { stage: null },
      }),
    );
  });

  it('retries a startup failure a bounded number of times and clears on success', async () => {
    vi.useFakeTimers();
    try {
      const start = vi
        .fn()
        .mockRejectedValueOnce(new Error('start failed'))
        .mockRejectedValueOnce(new Error('start failed'))
        .mockResolvedValueOnce(run('run-retry', 'QUEUED'));
      const updateMany = vi.fn(async () => ({ count: 1 }));
      const service = automation(
        start,
        vi.fn(async () => run('run-retry', 'COMPLETED')),
        {
          research: { findMany: vi.fn(async () => []), updateMany },
        },
      );

      await service.afterStage04Completed('research-1');
      expect(start).toHaveBeenCalledTimes(1);
      expect(updateMany).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(250);
      expect(start).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(start).toHaveBeenCalledTimes(3);
      expect(updateMany).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves the pending marker after the retry budget is exhausted', async () => {
    vi.useFakeTimers();
    try {
      const start = vi.fn().mockRejectedValue(new Error('start failed'));
      const updateMany = vi.fn();
      const service = automation(start, vi.fn(), {
        research: { findMany: vi.fn(async () => []), updateMany },
      });

      await service.afterStage04Completed('research-1');
      await vi.advanceTimersByTimeAsync(250);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(start).toHaveBeenCalledTimes(3);
      expect(updateMany).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('contains Stage 05 execution failures without rejecting completion handling', async () => {
    const start = vi.fn(async () => run('run-1', 'QUEUED'));
    const execute = vi.fn(async () => {
      throw new Error('stage 05 failed');
    });
    const service = automation(start, execute);

    await expect(
      service.afterStage04Completed('research-1'),
    ).resolves.toBeUndefined();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  });
});
