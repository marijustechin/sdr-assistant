import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { FakeQualifier, FakeStore, acceptedDraft, makeService, persistedProfile, researchRecord, sourceCompany } from './helpers.js';
import { RunWideError, type RunUsage } from '../../src/modules/lead-qualification/lead-qualification.types.js';

function twoCompanies() {
  return [
    sourceCompany({ sourceIndex: 0, domain: 'alpha.test', key: 'alpha.test' }),
    sourceCompany({ sourceIndex: 1, domain: 'beta.test', key: 'beta.test' }),
  ];
}

describe('SDR-007A run lifecycle and persistence', () => {
  it('runs independently, persists every company and publishes a complete run', async () => {
    const store = new FakeStore(researchRecord(twoCompanies()));
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    const completed = await service.execute(created.id);

    expect(completed.status).toBe('COMPLETED');
    expect(completed.processedCount).toBe(2);
    expect(completed.acceptedCount).toBe(2);
    expect(store.completeCalls).toEqual([created.id]);
    expect(store.results.get(created.id)?.size).toBe(2);
    expect(store.runs.get(created.id)?.record.publishedAt).not.toBeNull();
  });

  it('persists a company-specific failure while completing other companies', async () => {
    const qualifier = new FakeQualifier(async (company) => {
      if (company.domain === 'beta.test') throw new Error('synthetic company failure');
      return acceptedDraft(company);
    });
    const store = new FakeStore(researchRecord(twoCompanies()));
    const service = makeService(store, qualifier);
    const created = await service.start('research-1', { autoStart: false });
    await service.execute(created.id);

    const results = [...(store.results.get(created.id)?.values() ?? [])];
    const failed = results.find((result) => result.domain === 'beta.test');
    expect(failed?.technicalFailure).toBe(true);
    expect(failed?.decision).toBe('EXCLUDED');
    expect(failed?.primaryExclusionReason).toBe('PROCESSING_FAILED');
    expect(store.runs.get(created.id)?.record.status).toBe('COMPLETED');
  });

  it('fails the whole run without publication on a run-wide error', async () => {
    const qualifier = new FakeQualifier(async () => {
      throw new RunWideError('PROVIDER_OUTAGE', 'synthetic outage');
    });
    const store = new FakeStore(researchRecord([sourceCompany()]));
    const service = makeService(store, qualifier);
    const created = await service.start('research-1', { autoStart: false });
    await expect(service.execute(created.id)).rejects.toBeInstanceOf(RunWideError);

    expect(store.runs.get(created.id)?.record.status).toBe('FAILED');
    expect(store.completeCalls).toEqual([]);
    expect(store.runs.get(created.id)?.record.publishedAt).toBeNull();
  });

  it('interrupts on stale execution ownership and never publishes', async () => {
    const store = new FakeStore(researchRecord([sourceCompany()]));
    store.forceLeaseLoss = true;
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });

    await expect(service.execute(created.id)).rejects.toBeInstanceOf(ConflictException);
    expect(store.runs.get(created.id)?.record.status).toBe('INTERRUPTED');
    expect(store.completeCalls).toEqual([]);
    expect(store.runs.get(created.id)?.record.publishedAt).toBeNull();
  });

  it('resumes only pending or technically failed companies', async () => {
    let failBeta = true;
    const qualifier = new FakeQualifier(async (company) => {
      if (company.domain === 'beta.test' && failBeta) {
        throw new Error('first attempt failure');
      }
      return acceptedDraft(company);
    });
    const store = new FakeStore(researchRecord(twoCompanies()));
    const service = makeService(store, qualifier);
    const created = await service.start('research-1', { autoStart: false });
    await service.execute(created.id);

    const internal = store.runs.get(created.id);
    if (!internal) throw new Error('run missing');
    internal.record.status = 'INTERRUPTED';
    internal.token = null;
    internal.leaseUntil = null;
    failBeta = false;
    qualifier.calls = 0;

    const resumed = await service.execute(created.id);
    expect(resumed.status).toBe('COMPLETED');
    expect(resumed.acceptedCount).toBe(2);
    expect(qualifier.calls).toBe(1);
  });

  it('keeps idempotent start keys distinct from deliberate new runs', async () => {
    const store = new FakeStore(researchRecord([sourceCompany()]));
    const service = makeService(store, new FakeQualifier());

    const first = await service.start('research-1', {
      idempotencyKey: 'request-1',
      autoStart: false,
    });
    await service.execute(first.id);
    const retry = await service.start('research-1', {
      idempotencyKey: 'request-1',
      autoStart: false,
    });
    const deliberate = await service.start('research-1', { autoStart: false });

    expect(retry.id).toBe(first.id);
    expect(deliberate.id).not.toBe(first.id);
    expect(store.runs.size).toBe(2);
  });

  it('rejects a second active run for the same research', async () => {
    const store = new FakeStore(researchRecord([sourceCompany()]));
    const service = makeService(store, new FakeQualifier());
    await service.start('research-1', { autoStart: false });
    await expect(
      service.start('research-1', { autoStart: false }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('retains a qualified duplicate representative and excludes only its peers', async () => {
    const alpha = sourceCompany({
      sourceIndex: 0,
      domain: 'alpha.test',
      key: 'alpha.test',
      legalName: 'Same Entity UAB',
      vat: 'LT999999999',
    });
    const beta = sourceCompany({
      sourceIndex: 1,
      domain: 'beta.test',
      key: 'beta.test',
      legalName: 'Same Entity UAB',
      vat: 'LT999999999',
    });
    const store = new FakeStore(researchRecord([alpha, beta]));
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    await service.execute(created.id);

    const results = [...(store.results.get(created.id)?.values() ?? [])];
    const accepted = results.filter((result) => result.decision === 'ACCEPTED');
    const excluded = results.filter((result) => result.decision === 'EXCLUDED');
    expect(accepted).toHaveLength(1);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.primaryExclusionReason).toBe('DUPLICATE_COMPANY');
    expect(excluded[0]?.checks.duplicate.canonicalCompanyKey).toBe(
      accepted[0]?.sourceCompanyKey,
    );
  });

  it('does not merge companies on unverified legal-name strings alone', async () => {
    const alpha = sourceCompany({
      sourceIndex: 0,
      domain: 'alpha.test',
      key: 'alpha.test',
      legalName: 'Shared Name UAB',
    });
    const beta = sourceCompany({
      sourceIndex: 1,
      domain: 'beta.test',
      key: 'beta.test',
      legalName: 'Shared Name UAB',
    });
    const store = new FakeStore(researchRecord([alpha, beta]));
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    const completed = await service.execute(created.id);
    expect(completed.acceptedCount).toBe(2);
    expect(completed.excludedCount).toBe(0);
  });

  it('accounts for malformed source profiles as technical results', async () => {
    const store = new FakeStore(researchRecord([]));
    store.research.result = {
      schemaVersion: 1,
      companies: [{ domain: 'broken.test' }],
    };
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    const completed = await service.execute(created.id);
    expect(completed.companyCount).toBe(1);
    expect(completed.processedCount).toBe(1);
    expect(completed.technicalFailureCount).toBe(1);
    expect(store.results.get(created.id)?.get(0)?.primaryExclusionReason).toBe(
      'PROCESSING_FAILED',
    );
  });

  it('retains durable budget usage across interruption and resume', async () => {
    const seenUsage: RunUsage[] = [];
    let failBeta = true;
    const qualifier = new FakeQualifier(async (company, _index, budget) => {
      seenUsage.push({ ...budget.usage });
      if (company.domain === 'beta.test' && failBeta) {
        throw new Error('interrupt before consuming budget');
      }
      budget.consumeLlm();
      budget.usage.promptTokens += 5;
      return acceptedDraft(company);
    });
    const store = new FakeStore(researchRecord(twoCompanies()));
    const service = makeService(store, qualifier);
    const created = await service.start('research-1', { autoStart: false });
    await service.execute(created.id);

    const internal = store.runs.get(created.id);
    if (!internal) throw new Error('run missing');
    expect(internal.record.usage.llmCalls).toBe(1);
    internal.record.status = 'INTERRUPTED';
    internal.token = null;
    internal.leaseUntil = null;
    failBeta = false;
    seenUsage.length = 0;

    const resumed = await service.execute(created.id);
    expect(resumed.status).toBe('COMPLETED');
    expect(seenUsage[0]?.llmCalls).toBe(1);
    expect(internal.record.usage.llmCalls).toBe(2);
  });

  it('enforces the serialized per-company result size bound', async () => {
    const qualifier = new FakeQualifier(async (company) => {
      const draft = acceptedDraft(company);
      draft.evidenceSources = Array.from({ length: 1_000 }, (_, index) => ({
        url: `https://${company.domain}/evidence-${index}`,
        kind: 'website' as const,
        quote: 'x'.repeat(300),
        source: 'http' as const,
        observedAt: '2026-01-01T00:00:00.000Z',
      }));
      return draft;
    });
    const store = new FakeStore(researchRecord([sourceCompany()]));
    const service = makeService(store, qualifier);
    const created = await service.start('research-1', { autoStart: false });
    await service.execute(created.id);
    const result = store.results.get(created.id)?.get(0);
    expect(result?.evidenceSources.length).toBeLessThan(1_000);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(
      102_400,
    );
  });

  it('publishes a valid empty source result', async () => {
    const store = new FakeStore(researchRecord([]));
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    const completed = await service.execute(created.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.processedCount).toBe(0);
    expect(store.runs.get(created.id)?.record.publishedAt).not.toBeNull();
  });

  it('supports historical unversioned companies results independently', async () => {
    const store = new FakeStore(researchRecord([sourceCompany()]));
    store.research.result = { companies: [persistedProfile(sourceCompany())] };
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    const completed = await service.execute(created.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.acceptedCount).toBe(1);
  });

  it('defaults result listing to accepted and keeps excluded records separate', async () => {
    const store = new FakeStore(researchRecord([sourceCompany()]));
    const service = makeService(store, new FakeQualifier());
    const created = await service.start('research-1', { autoStart: false });
    await service.execute(created.id);

    const accepted = await service.listResults(created.id);
    const excluded = await service.listResults(created.id, { decision: 'EXCLUDED' });
    expect(accepted.items).toHaveLength(1);
    expect(excluded.items).toHaveLength(0);
    expect(accepted.items[0]?.source.researchId).toBe('research-1');
    expect(JSON.stringify(accepted.items[0])).not.toContain('executionToken');
  });
});
