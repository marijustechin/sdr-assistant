import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ExclusionReason,
  LeadQualificationRunStatus,
  LeadQualificationTrigger,
  QualificationChecks,
  QualificationDecision,
  QualificationMetadata,
  RunUsage,
  EmailContact,
  PhoneContact,
  EvidenceRef,
} from './lead-qualification.types.js';
import { LostLeaseError } from './lead-qualification.types.js';

export const LEAD_QUALIFICATION_STORE = Symbol('LEAD_QUALIFICATION_STORE');

export type ResearchRecord = {
  id: string;
  status: string;
  country: string;
  result: unknown;
  productName: string;
  productDescription: string;
};

export type RunRecord = {
  id: string;
  researchId: string;
  status: LeadQualificationRunStatus;
  trigger: LeadQualificationTrigger;
  targetCountry: string;
  qualificationVersion: string;
  policyVersion: string;
  promptVersion: string | null;
  inputFingerprint: string;
  sourceResultSchemaVersion: number | null;
  companyCount: number;
  processedCount: number;
  acceptedCount: number;
  excludedCount: number;
  technicalFailureCount: number;
  usage: RunUsage;
  startKey: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  publishedAt: Date | null;
  supersededAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ResultRecord = {
  id: string;
  runId: string;
  sourceCompanyIndex: number;
  sourceCompanyKey: string;
  domain: string;
  companyName: string | null;
  legalName: string | null;
  country: string | null;
  profileHash: string;
  decision: QualificationDecision;
  primaryExclusionReason: ExclusionReason | null;
  exclusionReasons: ExclusionReason[];
  technicalFailure: boolean;
  checks: QualificationChecks;
  contacts: {
    emails: EmailContact[];
    phones: PhoneContact[];
  };
  evidenceSources: EvidenceRef[];
  metadata: QualificationMetadata;
  createdAt: Date;
  updatedAt: Date;
};

export type SaveResultInput = Omit<
  ResultRecord,
  'id' | 'createdAt' | 'updatedAt'
>;

export type ResultFilter = {
  decision: QualificationDecision;
  reason?: ExclusionReason;
  technicalFailure?: boolean;
  q?: string;
  cursor?: string;
  limit: number;
};

export type PagedResults = {
  items: ResultRecord[];
  nextCursor: string | null;
};

export type RunCounts = {
  processedCount: number;
  acceptedCount: number;
  excludedCount: number;
  technicalFailureCount: number;
};

export type CreateRunInput = {
  researchId: string;
  trigger: LeadQualificationTrigger;
  targetCountry: string;
  qualificationVersion: string;
  policyVersion: string;
  promptVersion: string | null;
  inputFingerprint: string;
  sourceResultSchemaVersion: number | null;
  companyCount: number;
  startKey: string | null;
};

export interface QualificationStore {
  findResearch(id: string): Promise<ResearchRecord | null>;
  findRun(id: string): Promise<RunRecord | null>;
  findLatestRun(researchId: string): Promise<RunRecord | null>;
  findPublishedRun(researchId: string): Promise<RunRecord | null>;
  findRunByStartKey(
    researchId: string,
    startKey: string,
  ): Promise<RunRecord | null>;
  findActiveRun(researchId: string): Promise<RunRecord | null>;
  createRun(input: CreateRunInput): Promise<RunRecord>;
  claimRun(id: string, token: string, leaseMs: number): Promise<boolean>;
  heartbeat(id: string, token: string, leaseMs: number): Promise<boolean>;
  updateProgress(
    id: string,
    token: string,
    counts: RunCounts,
    usage: RunUsage,
  ): Promise<boolean>;
  saveResult(input: SaveResultInput, token: string): Promise<ResultRecord>;
  findResultsForRun(runId: string): Promise<ResultRecord[]>;
  listResults(runId: string, filter: ResultFilter): Promise<PagedResults>;
  getResult(runId: string, resultId: string): Promise<ResultRecord | null>;
  updateResult(input: SaveResultInput & { id: string }, token: string): Promise<ResultRecord>;
  completeAndPublish(
    id: string,
    token: string,
    counts: RunCounts,
    usage: RunUsage,
  ): Promise<boolean>;
  failRun(id: string, token: string, error: string): Promise<void>;
  markInterrupted(id: string, token: string, error: string): Promise<void>;
}

export function emptyUsage(): RunUsage {
  return {
    llmCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    fetches: 0,
    searches: 0,
    retries: 0,
  };
}

export function toRunUsage(value: unknown): RunUsage {
  const source =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const number = (key: keyof RunUsage): number => {
    const candidate = source[key];
    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? candidate
      : 0;
  };
  return {
    llmCalls: number('llmCalls'),
    promptTokens: number('promptTokens'),
    completionTokens: number('completionTokens'),
    fetches: number('fetches'),
    searches: number('searches'),
    retries: number('retries'),
  };
}

async function lockExecution(
  tx: Prisma.TransactionClient,
  runId: string,
  token: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM lead_qualification_runs
    WHERE id = ${runId}
      AND status::text = 'RUNNING'
      AND "executionToken" = ${token}
      AND "executionLeaseUntil" > NOW()
    FOR UPDATE
  `;
  return rows.length === 1;
}

export function asJson(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function toRunRecord(row: {
  id: string;
  researchId: string;
  status: string;
  trigger: string;
  targetCountry: string;
  qualificationVersion: string;
  policyVersion: string;
  promptVersion: string | null;
  inputFingerprint: string;
  sourceResultSchemaVersion: number | null;
  companyCount: number;
  processedCount: number;
  acceptedCount: number;
  excludedCount: number;
  technicalFailureCount: number;
  usage: Prisma.JsonValue;
  startKey: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  publishedAt: Date | null;
  supersededAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RunRecord {
  return {
    id: row.id,
    researchId: row.researchId,
    status: row.status as LeadQualificationRunStatus,
    trigger: row.trigger as LeadQualificationTrigger,
    targetCountry: row.targetCountry,
    qualificationVersion: row.qualificationVersion,
    policyVersion: row.policyVersion,
    promptVersion: row.promptVersion,
    inputFingerprint: row.inputFingerprint,
    sourceResultSchemaVersion: row.sourceResultSchemaVersion,
    companyCount: row.companyCount,
    processedCount: row.processedCount,
    acceptedCount: row.acceptedCount,
    excludedCount: row.excludedCount,
    technicalFailureCount: row.technicalFailureCount,
    usage: toRunUsage(row.usage),
    startKey: row.startKey,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    publishedAt: row.publishedAt,
    supersededAt: row.supersededAt,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toResultRecord(row: {
  id: string;
  runId: string;
  sourceCompanyIndex: number;
  sourceCompanyKey: string;
  domain: string;
  companyName: string | null;
  legalName: string | null;
  country: string | null;
  profileHash: string;
  decision: string;
  primaryExclusionReason: string | null;
  exclusionReasons: string[];
  technicalFailure: boolean;
  checks: Prisma.JsonValue;
  contacts: Prisma.JsonValue;
  evidenceSources: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): ResultRecord {
  return {
    id: row.id,
    runId: row.runId,
    sourceCompanyIndex: row.sourceCompanyIndex,
    sourceCompanyKey: row.sourceCompanyKey,
    domain: row.domain,
    companyName: row.companyName,
    legalName: row.legalName,
    country: row.country,
    profileHash: row.profileHash,
    decision: row.decision as QualificationDecision,
    primaryExclusionReason:
      row.primaryExclusionReason as ExclusionReason | null,
    exclusionReasons: row.exclusionReasons as ExclusionReason[],
    technicalFailure: row.technicalFailure,
    checks: row.checks as unknown as QualificationChecks,
    contacts: row.contacts as unknown as ResultRecord['contacts'],
    evidenceSources:
      row.evidenceSources as unknown as ResultRecord['evidenceSources'],
    metadata: row.metadata as unknown as QualificationMetadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function resultData(input: SaveResultInput) {
  return {
    runId: input.runId,
    sourceCompanyIndex: input.sourceCompanyIndex,
    sourceCompanyKey: input.sourceCompanyKey,
    domain: input.domain,
    companyName: input.companyName,
    legalName: input.legalName,
    country: input.country,
    profileHash: input.profileHash,
    decision: input.decision,
    primaryExclusionReason: input.primaryExclusionReason,
    exclusionReasons: input.exclusionReasons,
    technicalFailure: input.technicalFailure,
    checks: asJson(input.checks),
    contacts: asJson(input.contacts),
    evidenceSources: asJson(input.evidenceSources),
    metadata: asJson(input.metadata),
  };
}

export class PrismaQualificationStore implements QualificationStore {
  constructor(private readonly prisma: PrismaService) {}

  async findResearch(id: string): Promise<ResearchRecord | null> {
    const row = await this.prisma.research.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        country: true,
        result: true,
        product: { select: { name: true, description: true } },
      },
    });

    if (row === null) return null;

    return {
      id: row.id,
      status: row.status,
      country: row.country,
      result: row.result,
      productName: row.product.name,
      productDescription: row.product.description,
    };
  }

  async findRun(id: string): Promise<RunRecord | null> {
    const row = await this.prisma.leadQualificationRun.findUnique({ where: { id } });
    return row === null ? null : toRunRecord(row);
  }

  async findLatestRun(researchId: string): Promise<RunRecord | null> {
    const row = await this.prisma.leadQualificationRun.findFirst({
      where: { researchId },
      orderBy: { createdAt: 'desc' },
    });
    return row === null ? null : toRunRecord(row);
  }

  async findPublishedRun(researchId: string): Promise<RunRecord | null> {
    const row = await this.prisma.leadQualificationRun.findFirst({
      where: { researchId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
    });
    return row === null ? null : toRunRecord(row);
  }

  async findRunByStartKey(
    researchId: string,
    startKey: string,
  ): Promise<RunRecord | null> {
    const row = await this.prisma.leadQualificationRun.findUnique({
      where: { researchId_startKey: { researchId, startKey } },
    });
    return row === null ? null : toRunRecord(row);
  }

  async findActiveRun(researchId: string): Promise<RunRecord | null> {
    const row = await this.prisma.leadQualificationRun.findFirst({
      where: {
        researchId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return row === null ? null : toRunRecord(row);
  }

  async createRun(input: CreateRunInput): Promise<RunRecord> {
    const row = await this.prisma.leadQualificationRun.create({
      data: {
        researchId: input.researchId,
        trigger: input.trigger,
        targetCountry: input.targetCountry,
        qualificationVersion: input.qualificationVersion,
        policyVersion: input.policyVersion,
        promptVersion: input.promptVersion,
        inputFingerprint: input.inputFingerprint,
        sourceResultSchemaVersion: input.sourceResultSchemaVersion,
        companyCount: input.companyCount,
        startKey: input.startKey,
      },
    });
    return toRunRecord(row);
  }

  async claimRun(id: string, token: string, leaseMs: number): Promise<boolean> {
    const now = new Date();
    const result = await this.prisma.leadQualificationRun.updateMany({
      where: {
        id,
        OR: [
          { status: { in: ['QUEUED', 'INTERRUPTED', 'FAILED'] } },
          { status: 'RUNNING', executionLeaseUntil: { lt: now } },
        ],
      },
      data: {
        status: 'RUNNING',
        executionToken: token,
        executionLeaseUntil: new Date(now.getTime() + leaseMs),
        lastHeartbeatAt: now,
        startedAt: now,
        error: null,
      },
    });
    return result.count === 1;
  }

  async heartbeat(
    id: string,
    token: string,
    leaseMs: number,
  ): Promise<boolean> {
    const now = new Date();
    const result = await this.prisma.leadQualificationRun.updateMany({
      where: {
        id,
        status: 'RUNNING',
        executionToken: token,
        executionLeaseUntil: { gt: now },
      },
      data: {
        lastHeartbeatAt: now,
        executionLeaseUntil: new Date(now.getTime() + leaseMs),
      },
    });
    return result.count === 1;
  }

  async updateProgress(
    id: string,
    token: string,
    counts: RunCounts,
    usage: RunUsage,
  ): Promise<boolean> {
    const result = await this.prisma.leadQualificationRun.updateMany({
      where: {
        id,
        status: 'RUNNING',
        executionToken: token,
        executionLeaseUntil: { gt: new Date() },
      },
      data: { ...counts, usage: asJson(usage) },
    });
    return result.count === 1;
  }

  async saveResult(input: SaveResultInput, token: string): Promise<ResultRecord> {
    const data = resultData(input);
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockExecution(tx, input.runId, token))) {
        throw new LostLeaseError();
      }
      const row = await tx.leadQualificationResult.upsert({
        where: {
          runId_sourceCompanyIndex: {
            runId: input.runId,
            sourceCompanyIndex: input.sourceCompanyIndex,
          },
        },
        create: data,
        update: data,
      });
      return toResultRecord(row);
    });
  }

  async findResultsForRun(runId: string): Promise<ResultRecord[]> {
    const rows = await this.prisma.leadQualificationResult.findMany({
      where: { runId },
      orderBy: { sourceCompanyIndex: 'asc' },
    });
    return rows.map(toResultRecord);
  }

  async listResults(
    runId: string,
    filter: ResultFilter,
  ): Promise<PagedResults> {
    const where: Prisma.LeadQualificationResultWhereInput = {
      runId,
      decision: filter.decision,
    };
    if (filter.reason !== undefined) {
      where.primaryExclusionReason = filter.reason;
    }
    if (filter.technicalFailure !== undefined) {
      where.technicalFailure = filter.technicalFailure;
    }
    if (filter.q !== undefined && filter.q.trim().length > 0) {
      where.OR = [
        { companyName: { contains: filter.q, mode: 'insensitive' } },
        { domain: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.leadQualificationResult.findMany({
      where,
      orderBy: { id: 'asc' },
      take: filter.limit + 1,
      ...(filter.cursor === undefined
        ? {}
        : { cursor: { id: filter.cursor }, skip: 1 }),
    });
    const hasMore = rows.length > filter.limit;
    const items = rows.slice(0, filter.limit).map(toResultRecord);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async getResult(
    runId: string,
    resultId: string,
  ): Promise<ResultRecord | null> {
    const row = await this.prisma.leadQualificationResult.findFirst({
      where: { id: resultId, runId },
    });
    return row === null ? null : toResultRecord(row);
  }

  async updateResult(input: SaveResultInput & { id: string }, token: string): Promise<ResultRecord> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockExecution(tx, input.runId, token))) {
        throw new LostLeaseError();
      }
      const row = await tx.leadQualificationResult.update({
        where: { id: input.id },
        data: resultData(input),
      });
      return toResultRecord(row);
    });
  }

  async completeAndPublish(
    id: string,
    token: string,
    counts: RunCounts,
    usage: RunUsage,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockExecution(tx, id, token))) return false;
      const run = await tx.leadQualificationRun.findUnique({ where: { id } });
      if (run === null) return false;

      const now = new Date();
      await tx.leadQualificationRun.updateMany({
        where: {
          researchId: run.researchId,
          publishedAt: { not: null },
          id: { not: id },
        },
        data: { publishedAt: null, supersededAt: now },
      });
      await tx.leadQualificationRun.update({
        where: { id },
        data: {
          ...counts,
          usage: asJson(usage),
          status: 'COMPLETED',
          completedAt: now,
          publishedAt: now,
          executionToken: null,
          executionLeaseUntil: null,
          error: null,
        },
      });
      return true;
    });
  }

  async failRun(id: string, token: string, error: string): Promise<void> {
    await this.prisma.leadQualificationRun.updateMany({
      where: { id, status: 'RUNNING', executionToken: token },
      data: {
        status: 'FAILED',
        error,
        executionToken: null,
        executionLeaseUntil: null,
        completedAt: new Date(),
      },
    });
  }

  async markInterrupted(id: string, token: string, error: string): Promise<void> {
    await this.prisma.leadQualificationRun.updateMany({
      where: { id, status: 'RUNNING', executionToken: token },
      data: {
        status: 'INTERRUPTED',
        error,
        executionToken: null,
        executionLeaseUntil: null,
      },
    });
  }
}
