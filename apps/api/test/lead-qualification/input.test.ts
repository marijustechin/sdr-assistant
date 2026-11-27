import { describe, expect, it } from 'vitest';

import {
  LeadQualificationInputError,
  parseResearchSource,
} from '../../src/modules/lead-qualification/lead-qualification.input.js';
import { persistedProfile, researchRecord, sourceCompany } from './helpers.js';

const LIMIT = 10_000_000;

describe('SDR-007A Stage 05 input contract', () => {
  it('accepts a versioned completed result and resolves the target code', () => {
    const study = parseResearchSource(
      researchRecord([sourceCompany()]),
      LIMIT,
    );
    expect(study.targetCountry).toBe('Lithuania');
    expect(study.targetCountryCode).toBe('LT');
    expect(study.resultSchemaVersion).toBe(1);
    expect(study.companies).toHaveLength(1);
    expect(study.skippedProfiles).toBe(0);
  });

  it('accepts a supported historical unversioned companies result', () => {
    const record = researchRecord([sourceCompany()]);
    record.result = { companies: [persistedProfile(sourceCompany())] };
    const study = parseResearchSource(record, LIMIT);
    expect(study.resultSchemaVersion).toBeNull();
    expect(study.companies).toHaveLength(1);
  });

  it('accepts a legitimate empty companies array', () => {
    const study = parseResearchSource(researchRecord([]), LIMIT);
    expect(study.companies).toEqual([]);
    expect(study.inputFingerprint).toHaveLength(64);
  });

  it('rejects incomplete research', () => {
    const record = researchRecord([sourceCompany()], { status: 'RUNNING' });
    expect(() => parseResearchSource(record, LIMIT)).toThrowError(
      LeadQualificationInputError,
    );
  });

  it('rejects a missing companies array', () => {
    const record = researchRecord([sourceCompany()]);
    record.result = { schemaVersion: 1 };
    expect(() => parseResearchSource(record, LIMIT)).toThrowError(
      /companies array/,
    );
  });

  it('rejects an unsupported schemaVersion', () => {
    const record = researchRecord([sourceCompany()]);
    record.result = { schemaVersion: 2, companies: [] };
    expect(() => parseResearchSource(record, LIMIT)).toThrowError(
      /Unsupported/,
    );
  });

  it('skips one malformed profile without discarding valid ones', () => {
    const record = researchRecord([sourceCompany()]);
    record.result = {
      schemaVersion: 1,
      companies: [persistedProfile(sourceCompany()), { domain: 'broken.test' }],
    };
    const study = parseResearchSource(record, LIMIT);
    expect(study.companies).toHaveLength(1);
    expect(study.skippedProfiles).toBe(1);
  });

  it('accounts for malformed profiles explicitly without discarding valid siblings', () => {
    const record = researchRecord([]);
    record.result = {
      schemaVersion: 1,
      companies: [{ domain: 'broken.test' }, { domain: 'also-broken.test' }],
    };
    const study = parseResearchSource(record, LIMIT);
    expect(study.companies).toEqual([]);
    expect(study.invalidProfiles).toHaveLength(2);
    expect(study.rawCompanyCount).toBe(2);
    expect(study.skippedProfiles).toBe(2);
  });

  it('binds the fingerprint to ordered company input and product metadata', () => {
    const alpha = sourceCompany({ sourceIndex: 0, domain: 'alpha.test', key: 'alpha.test' });
    const beta = sourceCompany({ sourceIndex: 1, domain: 'beta.test', key: 'beta.test' });
    const first = parseResearchSource(researchRecord([alpha, beta]), LIMIT);
    const second = parseResearchSource(researchRecord([beta, alpha]), LIMIT);
    expect(first.inputFingerprint).not.toBe(second.inputFingerprint);
    const changed = parseResearchSource(
      researchRecord([{ ...alpha, name: 'Changed UAB' }, beta]),
      LIMIT,
    );
    expect(changed.inputFingerprint).not.toBe(first.inputFingerprint);
    const productChanged = parseResearchSource(
      researchRecord([alpha, beta], { productName: 'Changed product' }),
      LIMIT,
    );
    expect(productChanged.inputFingerprint).not.toBe(first.inputFingerprint);
  });

  it('rejects an over-limit source payload', () => {
    expect(() =>
      parseResearchSource(researchRecord([sourceCompany()]), 10),
    ).toThrowError(/exceeds/);
  });
});
