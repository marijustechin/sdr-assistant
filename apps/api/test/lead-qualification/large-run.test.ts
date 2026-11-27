import { describe, expect, it } from 'vitest';

import { FakeQualifier, FakeStore, makeService, researchRecord, sourceCompany } from './helpers.js';

describe('SDR-007A synthetic large run', () => {
  it(
    'processes 2,000 companies with bounded concurrency and durable results',
    async () => {
      const companies = Array.from({ length: 2_000 }, (_, index) =>
        sourceCompany({
          sourceIndex: index,
          domain: `company-${index}.test`,
          key: `company-${index}.test`,
        }),
      );
      const store = new FakeStore(researchRecord(companies));
      const qualifier = new FakeQualifier();
      const service = makeService(store, qualifier);
      const created = await service.start('research-1', { autoStart: false });

      const completed = await service.execute(created.id);

      expect(completed.status).toBe('COMPLETED');
      expect(completed.processedCount).toBe(2_000);
      expect(completed.acceptedCount).toBe(2_000);
      expect(store.results.get(created.id)?.size).toBe(2_000);
      expect(qualifier.maxActive).toBeLessThanOrEqual(8);
      expect(qualifier.maxActive).toBeGreaterThan(1);
    },
    30_000,
  );
});
