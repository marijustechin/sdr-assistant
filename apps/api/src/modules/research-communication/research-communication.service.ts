import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  selectRecipients,
  type RecipientSelectionReason,
} from './research-recipient-selection.js';
import {
  DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
  type RecipientQueueQuery,
} from './research-recipient-queue.query.js';

export type ResearchInitialEmail = {
  readonly subject: string;
  readonly body: string;
};

export type ResearchCommunicationSettings = {
  readonly emailAccountId: string | null;
  readonly initialEmail: ResearchInitialEmail | null;
};

export type ResearchEmailAccountAssignment = {
  readonly emailAccountId: string | null;
};

export type RecipientQueuePublication = {
  readonly runId: string;
  readonly publishedAt: string;
};

export type RecipientQueueItem = {
  readonly id: string;
  readonly companyName: string | null;
  readonly domain: string;
  readonly primaryEmail: string;
  readonly alternativeEmails: string[];
  readonly selectionReason: RecipientSelectionReason;
  readonly status: 'PREPARED';
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RecipientQueueTotals = {
  readonly retainedCompanies: number;
  readonly preparedRecipients: number;
  readonly alternativeContacts: number;
};

export type RecipientQueueView = {
  /**
   * The current published Stage 05 run, or `null` when none exists. Only rows
   * prepared from this run are ever returned, so a superseded publication never
   * appears as the current queue.
   */
  readonly publication: RecipientQueuePublication | null;
  /** True when the queue was prepared from the current published run. */
  readonly prepared: boolean;
  readonly totals: RecipientQueueTotals;
  readonly items: RecipientQueueItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
};

const EMPTY_TOTALS: RecipientQueueTotals = {
  retainedCompanies: 0,
  preparedRecipients: 0,
  alternativeContacts: 0,
};

const MAX_INITIAL_EMAIL_SUBJECT_LENGTH = 300;
const MAX_INITIAL_EMAIL_BODY_LENGTH = 20_000;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function initialEmailColumns(
  subject: string | null,
  body: string | null,
): ResearchInitialEmail | null {
  if (subject === null && body === null) return null;
  return { subject: subject ?? '', body: body ?? '' };
}

/**
 * Research-specific communication settings and the prepared recipient queue.
 *
 * This module deliberately sits outside `modules/research`: the settings and the
 * prepared queue are configuration and derived data, not research execution.
 * No endpoint sends email, opens a mailbox, tests SMTP/IMAP or returns
 * credential material. A prepared recipient is not evidence of permission to
 * send marketing email and is never marked as eligible, authorized or sent.
 */
@Injectable()
export class ResearchCommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reads the communication settings: account assignment and initial email. */
  async getCommunicationSettings(
    jobId: string,
  ): Promise<ResearchCommunicationSettings> {
    await this.requireResearch(jobId);

    const settings =
      await this.prisma.researchCommunicationSettings.findUnique({
        where: { researchId: jobId },
        select: {
          emailAccountId: true,
          initialEmailSubject: true,
          initialEmailBody: true,
        },
      });

    return {
      emailAccountId: settings?.emailAccountId ?? null,
      initialEmail: initialEmailColumns(
        settings?.initialEmailSubject ?? null,
        settings?.initialEmailBody ?? null,
      ),
    };
  }

  /**
   * Assigns, changes or removes the email account.
   *
   * A non-null id must reference an existing enabled account. A disabled account
   * that is already assigned keeps its assignment on reads; it is only rejected
   * when a request tries to assign it. `null` removes the assignment, and the
   * settings row is kept so a future communication setting is not lost. The
   * initial email is never rewritten by this operation.
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

  /**
   * Saves the owner-authored plain-text initial email. Both fields are required;
   * the same message will later be sent individually to each prepared recipient.
   * No personalization variable, attachment or rich text is accepted.
   */
  async updateInitialEmail(
    jobId: string,
    subject: string,
    body: string,
  ): Promise<ResearchInitialEmail> {
    await this.requireResearch(jobId);

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (trimmedSubject === '') {
      throw new BadRequestException('The initial email subject is required.');
    }
    if (trimmedBody === '') {
      throw new BadRequestException('The initial email message is required.');
    }
    if (trimmedSubject.length > MAX_INITIAL_EMAIL_SUBJECT_LENGTH) {
      throw new BadRequestException(
        `The initial email subject must be at most ${MAX_INITIAL_EMAIL_SUBJECT_LENGTH} characters.`,
      );
    }
    if (trimmedBody.length > MAX_INITIAL_EMAIL_BODY_LENGTH) {
      throw new BadRequestException(
        `The initial email message must be at most ${MAX_INITIAL_EMAIL_BODY_LENGTH} characters.`,
      );
    }

    await this.prisma.researchCommunicationSettings.upsert({
      where: { researchId: jobId },
      create: {
        researchId: jobId,
        initialEmailSubject: trimmedSubject,
        initialEmailBody: trimmedBody,
      },
      update: {
        initialEmailSubject: trimmedSubject,
        initialEmailBody: trimmedBody,
      },
    });

    return { subject: trimmedSubject, body: trimmedBody };
  }

  /**
   * Ensures the prepared recipient queue matches the current published Stage 05
   * result, then returns one queue page.
   *
   * Preparation is skipped when the stored source-run marker already matches the
   * published run, so repeated calls are idempotent and write nothing. With no
   * published result nothing is written or deleted and the missing-publication
   * state is returned.
   */
  async prepareRecipientQueue(jobId: string): Promise<RecipientQueueView> {
    await this.requireResearch(jobId);

    const publication = await this.findPublishedRun(jobId);
    if (publication === null) {
      return {
        publication: null,
        prepared: false,
        totals: EMPTY_TOTALS,
        items: [],
        page: 1,
        pageSize: DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
        totalItems: 0,
      };
    }

    const settings =
      await this.prisma.researchCommunicationSettings.findUnique({
        where: { researchId: jobId },
        select: { recipientQueueSourceRunId: true },
      });

    if (settings?.recipientQueueSourceRunId !== publication.runId) {
      await this.reconcileRecipientQueue(jobId, publication.runId);
    }

    return this.readRecipientQueue(jobId, publication, {
      q: '',
      page: 1,
      pageSize: DEFAULT_RECIPIENT_QUEUE_PAGE_SIZE,
    });
  }

  /** Reads the persisted queue. This method never writes or prepares. */
  async getRecipientQueue(
    jobId: string,
    query: RecipientQueueQuery,
  ): Promise<RecipientQueueView> {
    await this.requireResearch(jobId);
    const publication = await this.findPublishedRun(jobId);
    return this.readRecipientQueue(jobId, publication, query);
  }

  private async findPublishedRun(
    researchId: string,
  ): Promise<RecipientQueuePublication | null> {
    const run = await this.prisma.leadQualificationRun.findFirst({
      where: { researchId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, publishedAt: true },
    });

    if (run === null || run.publishedAt === null) return null;

    return { runId: run.id, publishedAt: run.publishedAt.toISOString() };
  }

  /**
   * Replaces the prepared set with a selection from one published run.
   *
   * V1 has no delivery history, so the prepared set can be replaced atomically.
   * The unique keys are the last line of defence against duplicates: a
   * concurrent preparation that wins the race makes this transaction fail with
   * a unique violation, which is treated as success because the other
   * preparation has already produced the same prepared set.
   */
  private async reconcileRecipientQueue(
    jobId: string,
    runId: string,
  ): Promise<void> {
    const rows = await this.prisma.leadQualificationResult.findMany({
      where: { runId, decision: 'ACCEPTED' },
      orderBy: { sourceCompanyIndex: 'asc' },
      select: {
        id: true,
        sourceCompanyIndex: true,
        domain: true,
        companyName: true,
        metadata: true,
      },
    });

    const prepared = selectRecipients(rows);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.researchRecipient.deleteMany({
          where: { researchId: jobId },
        });

        if (prepared.length > 0) {
          await transaction.researchRecipient.createMany({
            data: prepared.map((recipient) => ({
              researchId: jobId,
              sourceRunId: runId,
              sourceResultId: recipient.sourceResultId,
              sourceCompanyIndex: recipient.sourceCompanyIndex,
              domain: recipient.domain,
              companyName: recipient.companyName,
              primaryEmail: recipient.primaryEmail,
              alternativeEmails: recipient.alternativeEmails,
              selectionReason: recipient.selectionReason,
              status: recipient.status,
            })),
          });
        }

        await transaction.researchCommunicationSettings.upsert({
          where: { researchId: jobId },
          create: { researchId: jobId, recipientQueueSourceRunId: runId },
          update: { recipientQueueSourceRunId: runId },
        });
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }

  private async readRecipientQueue(
    jobId: string,
    publication: RecipientQueuePublication | null,
    query: RecipientQueueQuery,
  ): Promise<RecipientQueueView> {
    if (publication === null) {
      return {
        publication: null,
        prepared: false,
        totals: EMPTY_TOTALS,
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        totalItems: 0,
      };
    }

    const baseWhere: Prisma.ResearchRecipientWhereInput = {
      researchId: jobId,
      sourceRunId: publication.runId,
    };
    const where: Prisma.ResearchRecipientWhereInput =
      query.q === ''
        ? baseWhere
        : {
            ...baseWhere,
            OR: [
              {
                companyName: { contains: query.q, mode: 'insensitive' },
              },
              { domain: { contains: query.q, mode: 'insensitive' } },
              {
                primaryEmail: { contains: query.q, mode: 'insensitive' },
              },
            ],
          };

    const [
      settings,
      retainedCompanies,
      preparedRecipients,
      alternativeRows,
      totalItems,
      rows,
    ] = await Promise.all([
      this.prisma.researchCommunicationSettings.findUnique({
        where: { researchId: jobId },
        select: { recipientQueueSourceRunId: true },
      }),
      this.prisma.leadQualificationResult.count({
        where: { runId: publication.runId, decision: 'ACCEPTED' },
      }),
      this.prisma.researchRecipient.count({ where: baseWhere }),
      this.prisma.researchRecipient.findMany({
        where: {
          ...baseWhere,
          NOT: { alternativeEmails: { isEmpty: true } },
        },
        select: { alternativeEmails: true },
      }),
      this.prisma.researchRecipient.count({ where }),
      this.prisma.researchRecipient.findMany({
        where,
        orderBy: [{ companyName: 'asc' }, { domain: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          companyName: true,
          domain: true,
          primaryEmail: true,
          alternativeEmails: true,
          selectionReason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const alternativeContacts = alternativeRows.reduce(
      (total, row) => total + row.alternativeEmails.length,
      0,
    );

    return {
      publication,
      prepared:
        settings?.recipientQueueSourceRunId === publication.runId,
      totals: {
        retainedCompanies,
        preparedRecipients,
        alternativeContacts,
      },
      items: rows.map((row) => ({
        id: row.id,
        companyName: row.companyName,
        domain: row.domain,
        primaryEmail: row.primaryEmail,
        alternativeEmails: row.alternativeEmails,
        selectionReason: row.selectionReason,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    };
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
