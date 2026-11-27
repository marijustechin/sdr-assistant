import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { ContactDiscoveryRuntime } from './contact-discovery.runtime.js';

export const CONTACT_DISCOVERY_RUNTIME = Symbol('CONTACT_DISCOVERY_RUNTIME');
export const STAGE05_PENDING_STAGE = '05-contact-discovery-pending';

const AUTO_START_KEY_PREFIX = 'stage05:contact-discovery-v1:';
const LAUNCH_RETRY_DELAYS_MS = [250, 1_000];
const MAX_LAUNCH_ATTEMPTS = LAUNCH_RETRY_DELAYS_MS.length + 1;

function autoStartKey(researchId: string): string {
  return `${AUTO_START_KEY_PREFIX}${researchId}`;
}

@Injectable()
export class ContactDiscoveryAutomationService implements OnModuleInit {
  private readonly logger = new Logger(ContactDiscoveryAutomationService.name);
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(CONTACT_DISCOVERY_RUNTIME)
    private readonly runtime: ContactDiscoveryRuntime,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  /**
   * Starts one automatic Stage 05 run for a successfully persisted Stage 04
   * result. The launch marker is cleared only after runtime.start has returned a
   * durably created run. Start failures are retried a bounded number of times;
   * the persisted marker remains the fallback after the retry budget is spent.
   */
  async afterStage04Completed(researchId: string): Promise<void> {
    await this.launch(researchId, 0);
  }

  async onModuleInit(): Promise<void> {
    if (this.prisma === undefined) return;

    try {
      const pendingResearch = await this.prisma.research.findMany({
        where: {
          status: 'COMPLETED',
          stage: STAGE05_PENDING_STAGE,
        },
        select: { id: true },
      });
      for (const research of pendingResearch) {
        await this.afterStage04Completed(research.id);
      }

      const now = new Date();
      const runs = await this.prisma.leadQualificationRun.findMany({
        where: {
          trigger: 'AUTO',
          qualificationVersion: 'contact-discovery-v1',
          status: { in: ['QUEUED', 'RUNNING', 'INTERRUPTED'] },
        },
        select: {
          id: true,
          status: true,
          executionLeaseUntil: true,
        },
      });

      for (const run of runs) {
        if (run.status === 'RUNNING' && run.executionLeaseUntil !== null) {
          const remaining = run.executionLeaseUntil.getTime() - now.getTime();
          if (remaining > 0) {
            const timer = setTimeout(
              () => this.startExecution(run.id),
              remaining + 1_000,
            );
            timer.unref?.();
            continue;
          }
        }
        this.startExecution(run.id);
      }
    } catch (error) {
      this.logger.error(
        `Automatic Stage 05 recovery failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async launch(researchId: string, attempt: number): Promise<void> {
    this.clearRetryTimer(researchId);

    try {
      const run = await this.runtime.start(researchId, {
        trigger: 'AUTO',
        autoStart: false,
        idempotencyKey: autoStartKey(researchId),
      });

      // runtime.start returns only after the run row exists.
      await this.prisma?.research.updateMany({
        where: {
          id: researchId,
          status: 'COMPLETED',
          stage: STAGE05_PENDING_STAGE,
        },
        data: { stage: null },
      });

      if (run.status === 'QUEUED' || run.status === 'INTERRUPTED') {
        this.startExecution(run.id);
      }
    } catch (error) {
      if (attempt < MAX_LAUNCH_ATTEMPTS - 1) {
        const delay = LAUNCH_RETRY_DELAYS_MS[attempt] ?? 0;
        const timer = setTimeout(() => {
          this.retryTimers.delete(researchId);
          void this.launch(researchId, attempt + 1);
        }, delay);
        timer.unref?.();
        this.retryTimers.set(researchId, timer);
        return;
      }

      this.logger.error(
        `Automatic Stage 05 start failed for research ${researchId} after ${
          MAX_LAUNCH_ATTEMPTS
        } attempts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private clearRetryTimer(researchId: string): void {
    const timer = this.retryTimers.get(researchId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.retryTimers.delete(researchId);
    }
  }

  private startExecution(runId: string): void {
    void this.runtime.execute(runId).catch((error: unknown) => {
      this.logger.warn(
        `Stage 05 execution did not complete for run ${runId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
