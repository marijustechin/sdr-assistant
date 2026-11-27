import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { ConflictException } from '@nestjs/common';

import type { Prisma } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import {
  LeadQualificationService,
} from '../../src/modules/lead-qualification/lead-qualification.service.js';
import type { CompanyQualifier } from '../../src/modules/lead-qualification/lead-qualification.engine.js';
import {
  PrismaQualificationStore,
  type SaveResultInput,
} from '../../src/modules/lead-qualification/lead-qualification.repository.js';
import type {
  QualificationDraft,
  SourceCompany,
} from '../../src/modules/lead-qualification/lead-qualification.types.js';
import {
  acceptedDraft,
  persistedProfile,
  sourceCompany,
} from '../lead-qualification/helpers.js';

const databaseUrl = process.env.SDR007A_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function json(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function saveInput(
  runId: string,
  company: SourceCompany,
  draft: QualificationDraft,
): SaveResultInput {
  return {
    runId,
    sourceCompanyIndex: company.sourceIndex,
    sourceCompanyKey: company.key,
    domain: company.domain,
    companyName: company.name,
    legalName: company.legalName,
    country: company.country,
    profileHash: company.profileHash,
    decision: draft.decision,
    primaryExclusionReason: draft.primaryExclusionReason,
    exclusionReasons: draft.exclusionReasons,
    technicalFailure: draft.metadata.technicalFailure,
    checks: draft.checks,
    contacts: draft.contacts,
    evidenceSources: draft.evidenceSources,
    metadata: draft.metadata,
  };
}

class SyntheticQualifier implements CompanyQualifier {
  calls = 0;

  async qualify(
    company: SourceCompany,
    _context: unknown,
    budget: { consumeLlm(): void },
  ): Promise<QualificationDraft> {
    this.calls += 1;
    budget.consumeLlm();
    return acceptedDraft(company);
  }
}

describePostgres('SDR-007A real PostgreSQL Stage 05 integration', () => {
  let prisma: PrismaService;
  let secondPrisma: PrismaService;
  let store: PrismaQualificationStore;
  let secondStore: PrismaQualificationStore;
  let productId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    secondPrisma = new PrismaService();
    await prisma.$connect();
    await secondPrisma.$connect();
    store = new PrismaQualificationStore(prisma);
    secondStore = new PrismaQualificationStore(secondPrisma);

    const product = await prisma.product.create({
      data: {
        name: 'Synthetic Stage 05 product',
        description: 'Synthetic integration product.',
      },
    });
    productId = product.id;

    const migrated = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(Number(migrated[0]?.count ?? 0)).toBe(11);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('lead_qualification_runs', 'lead_qualification_results')
      ORDER BY table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      'lead_qualification_results',
      'lead_qualification_runs',
    ]);

    const fks = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT conrelid::regclass::text AS table_name
      FROM pg_constraint
      WHERE confrelid IN (
        'researches'::regclass,
        'lead_qualification_runs'::regclass
      )
      ORDER BY table_name
    `;
    expect(fks.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        'lead_qualification_runs',
        'lead_qualification_results',
        'research_stage_01_results',
        'research_stage_02_results',
        'research_stage_03_results',
      ]),
    );

    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'lead_qualification_one_active_run_per_research',
          'lead_qualification_one_published_run_per_research'
        )
      ORDER BY indexname
    `;
    expect(indexes.map((row) => row.indexname)).toEqual([
      'lead_qualification_one_active_run_per_research',
      'lead_qualification_one_published_run_per_research',
    ]);

    const migrationCandidates = [
      join(process.cwd(), 'prisma', 'migrations', '20261126173000_add_lead_qualification', 'migration.sql'),
      join(process.cwd(), 'apps', 'api', 'prisma', 'migrations', '20261126173000_add_lead_qualification', 'migration.sql'),
    ];
    const migrationPath = migrationCandidates.find((candidate) => existsSync(candidate));
    if (!migrationPath) throw new Error('Stage 05 migration file was not found.');
    const migrationSql = readFileSync(migrationPath, 'utf8');
    expect(migrationSql).not.toMatch(/DROP\s+TABLE/i);
    expect(migrationSql).not.toMatch(/ALTER\s+TABLE\s+"(?:researches|research_stage)/i);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await secondPrisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.leadQualificationResult.deleteMany();
    await prisma.leadQualificationRun.deleteMany();
    await prisma.research.deleteMany();
  });

  async function seedResearch(companies: SourceCompany[]): Promise<string> {
    const research = await prisma.research.create({
      data: {
        productId,
        country: 'Lithuania',
        status: 'COMPLETED',
        stage: '04-company-profiling',
        result: json({
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies: companies.map(persistedProfile),
        }),
      },
    });
    return research.id;
  }

  it('fences stale workers after lease takeover and publishes only the new owner', async () => {
    const alpha = sourceCompany({ sourceIndex: 0, domain: 'alpha.test' });
    const beta = sourceCompany({ sourceIndex: 1, domain: 'beta.test' });
    const researchId = await seedResearch([alpha, beta]);
    const service = new LeadQualificationService(store, new SyntheticQualifier());
    const run = await service.start(researchId, { autoStart: false });

    const tokenA = 'worker-a-token';
    const tokenB = 'worker-b-token';
    expect(await store.claimRun(run.id, tokenA, 60_000)).toBe(true);
    await store.saveResult(saveInput(run.id, alpha, acceptedDraft(alpha)), tokenA);

    await prisma.leadQualificationRun.update({
      where: { id: run.id },
      data: { executionLeaseUntil: new Date(Date.now() - 1_000) },
    });
    expect(await secondStore.claimRun(run.id, tokenB, 60_000)).toBe(true);

    await expect(
      store.saveResult(saveInput(run.id, beta, acceptedDraft(beta)), tokenA),
    ).rejects.toBeInstanceOf(Error);
    expect(await store.updateProgress(
      run.id,
      tokenA,
      { processedCount: 2, acceptedCount: 2, excludedCount: 0, technicalFailureCount: 0 },
      { llmCalls: 0, promptTokens: 0, completionTokens: 0, fetches: 0, searches: 0, retries: 0 },
    )).toBe(false);
    expect(await store.completeAndPublish(
      run.id,
      tokenA,
      { processedCount: 2, acceptedCount: 2, excludedCount: 0, technicalFailureCount: 0 },
      { llmCalls: 0, promptTokens: 0, completionTokens: 0, fetches: 0, searches: 0, retries: 0 },
    )).toBe(false);

    await secondStore.saveResult(
      saveInput(run.id, beta, acceptedDraft(beta)),
      tokenB,
    );
    await secondStore.updateProgress(
      run.id,
      tokenB,
      { processedCount: 2, acceptedCount: 2, excludedCount: 0, technicalFailureCount: 0 },
      { llmCalls: 0, promptTokens: 0, completionTokens: 0, fetches: 0, searches: 0, retries: 1 },
    );
    expect(await secondStore.completeAndPublish(
      run.id,
      tokenB,
      { processedCount: 2, acceptedCount: 2, excludedCount: 0, technicalFailureCount: 0 },
      { llmCalls: 0, promptTokens: 0, completionTokens: 0, fetches: 0, searches: 0, retries: 1 },
    )).toBe(true);

    const finalRun = await store.findRun(run.id);
    expect(finalRun?.status).toBe('COMPLETED');
    expect(finalRun?.publishedAt).not.toBeNull();
    expect(await prisma.leadQualificationResult.count({ where: { runId: run.id } })).toBe(2);
  });

  it('handles concurrent idempotent starts and deliberate new runs', async () => {
    const company = sourceCompany();
    const researchId = await seedResearch([company]);
    const serviceA = new LeadQualificationService(store, new SyntheticQualifier());
    const serviceB = new LeadQualificationService(secondStore, new SyntheticQualifier());

    const [left, right] = await Promise.all([
      serviceA.start(researchId, { idempotencyKey: 'same-request', autoStart: false }),
      serviceB.start(researchId, { idempotencyKey: 'same-request', autoStart: false }),
    ]);
    expect(left.id).toBe(right.id);
    expect(await prisma.leadQualificationRun.count({ where: { researchId } })).toBe(1);

    await expect(
      serviceB.start(researchId, { idempotencyKey: 'different-request', autoStart: false }),
    ).rejects.toBeInstanceOf(ConflictException);

    await serviceA.execute(left.id);
    const deliberate = await serviceA.start(researchId, { autoStart: false });
    expect(deliberate.id).not.toBe(left.id);
  });

  it('persists malformed-profile accounting and resumes an interrupted run without duplicates', async () => {
    const alpha = sourceCompany({ sourceIndex: 0, domain: 'alpha.test' });
    const beta = sourceCompany({ sourceIndex: 1, domain: 'beta.test' });
    const researchId = await seedResearch([alpha, beta]);
    await prisma.research.update({
      where: { id: researchId },
      data: {
        result: json({
          schemaVersion: 1,
          completedThrough: '04-company-profiling',
          companies: [
            persistedProfile(alpha),
            persistedProfile(beta),
            { domain: 'broken.test' },
          ],
        }),
      },
    });

    const qualifier = new SyntheticQualifier();
    const service = new LeadQualificationService(store, qualifier);
    const run = await service.start(researchId, { autoStart: false });

    // Simulate a worker stopping after one durable company result.
    expect(await store.claimRun(run.id, 'interrupted-worker', 60_000)).toBe(true);
    await store.saveResult(
      saveInput(run.id, alpha, acceptedDraft(alpha)),
      'interrupted-worker',
    );
    await prisma.leadQualificationRun.update({
      where: { id: run.id },
      data: {
        status: 'INTERRUPTED',
        executionToken: null,
        executionLeaseUntil: null,
        processedCount: 1,
        acceptedCount: 1,
        usage: {
          llmCalls: 1,
          promptTokens: 0,
          completionTokens: 0,
          fetches: 0,
          searches: 0,
          retries: 0,
        },
      },
    });

    const completed = await service.execute(run.id);
    expect(completed.companyCount).toBe(3);
    expect(completed.processedCount).toBe(3);
    expect(completed.technicalFailureCount).toBe(1);
    expect(completed.usage.llmCalls).toBe(2);
    expect(await prisma.leadQualificationResult.count({ where: { runId: run.id } })).toBe(3);
    expect(qualifier.calls).toBe(1);
  });

  it('preserves publication history and keeps the current published run identifiable', async () => {
    const company = sourceCompany();
    const researchId = await seedResearch([company]);
    const service = new LeadQualificationService(store, new SyntheticQualifier());

    const first = await service.start(researchId, { autoStart: false });
    await service.execute(first.id);
    const firstRun = await store.findRun(first.id);
    expect(firstRun?.publishedAt).not.toBeNull();

    const second = await service.start(researchId, { autoStart: false });
    await service.execute(second.id);
    const firstAfter = await store.findRun(first.id);
    const secondRun = await store.findRun(second.id);
    expect(firstAfter?.publishedAt).toBeNull();
    expect(firstAfter?.supersededAt).not.toBeNull();
    expect(secondRun?.publishedAt).not.toBeNull();
    expect((await store.findPublishedRun(researchId))?.id).toBe(second.id);
  });

  it('rolls back a forced result write without partial progress or orphan rows', async () => {
    const company = sourceCompany();
    const researchId = await seedResearch([company]);
    const service = new LeadQualificationService(store, new SyntheticQualifier());
    const run = await service.start(researchId, { autoStart: false });
    const token = 'rollback-token';
    expect(await store.claimRun(run.id, token, 60_000)).toBe(true);

    const invalid = saveInput(run.id, company, acceptedDraft(company));
    (invalid as { decision: string }).decision = 'INVALID';
    await expect(store.saveResult(invalid, token)).rejects.toBeInstanceOf(Error);

    expect(await prisma.leadQualificationResult.count({ where: { runId: run.id } })).toBe(0);
    const current = await store.findRun(run.id);
    expect(current?.processedCount).toBe(0);
    expect(current?.acceptedCount).toBe(0);

    const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM lead_qualification_results r
      LEFT JOIN lead_qualification_runs run ON run.id = r."runId"
      WHERE run.id IS NULL
    `;
    expect(Number(orphans[0]?.count ?? 0)).toBe(0);
  });
});
