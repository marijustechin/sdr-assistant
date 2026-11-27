import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The only value this module returns: the currently assigned email account, or
 * `null`. Account configuration and credentials never travel through this
 * response; the Settings tab reads safe account metadata from the existing
 * email-account endpoints.
 */
export type ResearchEmailAccountAssignment = {
  readonly emailAccountId: string | null;
};

/**
 * Research-specific communication settings.
 *
 * This module deliberately sits outside `modules/research`: the assignment is
 * independent configuration and does not change research execution, results or
 * any research API response. Only the assignment is returned, and an existing
 * assignment is never rewritten automatically.
 */
@Injectable()
export class ResearchCommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmailAccountAssignment(
    jobId: string,
  ): Promise<ResearchEmailAccountAssignment> {
    await this.requireResearch(jobId);

    const settings =
      await this.prisma.researchCommunicationSettings.findUnique({
        where: { researchId: jobId },
        select: { emailAccountId: true },
      });

    return { emailAccountId: settings?.emailAccountId ?? null };
  }

  /**
   * Assigns, changes or removes the email account.
   *
   * A non-null id must reference an existing enabled account. A disabled account
   * that is already assigned keeps its assignment on reads; it is only rejected
   * when a request tries to assign it. `null` removes the assignment, and the
   * settings row is kept so a future communication setting is not lost.
   */
  async updateEmailAccountAssignment(
    jobId: string,
    emailAccountId: string | null,
  ): Promise<ResearchEmailAccountAssignment> {
    await this.requireResearch(jobId);

    if (emailAccountId !== null) {
      const account = await this.prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
        select: { enabled: true },
      });

      if (account === null) {
        throw new NotFoundException(
          `Email account ${emailAccountId} not found`,
        );
      }

      if (!account.enabled) {
        throw new ConflictException(
          'Only enabled email accounts can be assigned',
        );
      }
    }

    const settings = await this.prisma.researchCommunicationSettings.upsert({
      where: { researchId: jobId },
      create: { researchId: jobId, emailAccountId },
      update: { emailAccountId },
      select: { emailAccountId: true },
    });

    return { emailAccountId: settings.emailAccountId };
  }

  private async requireResearch(jobId: string): Promise<void> {
    const research = await this.prisma.research.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (research === null) {
      throw new NotFoundException(`Research ${jobId} not found`);
    }
  }
}
