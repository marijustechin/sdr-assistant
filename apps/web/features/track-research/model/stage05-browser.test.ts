import { describe, expect, it } from 'vitest';

import type { Stage05Payload } from '@/entities/research/client';

import {
  buildStage05Rows,
  filterStage05Rows,
  stage05ReasonLabel,
  stage05Totals,
} from './stage05-browser';

function result(
  domain: string,
  name: string,
  decision: 'ACCEPTED' | 'EXCLUDED',
  emails: Array<{
    value: string;
    ownership: 'usable' | 'partner' | 'uncertain';
  }>,
): Stage05Payload['results'][number] {
  return {
    id: `result-${domain}`,
    runId: 'run-1',
    decision,
    primaryExclusionReason: decision === 'EXCLUDED' ? 'EMAIL_NOT_FOUND' : null,
    source: {
      researchId: 'research-1',
      sourceCompanyIndex: 0,
      sourceCompanyKey: domain,
      domain,
      profileHash: 'hash',
      name,
      legalName: null,
      country: 'Lithuania',
    },
    metadata: {
      contactDiscovery: {
        domain,
        companyName: name,
        emails: emails.map((email) => ({
          ...email,
          sources: [
            {
              origin: 'homepage',
              method: 'mailto',
              sourceUrl: `https://${domain}/contact`,
            },
          ],
          employeeName: null,
          employeePosition: null,
          employeeAssociation: 'unknown',
        })),
        phones: [],
        addresses: [],
        registrationIdentifiers: [],
      },
    },
  };
}

const payload: Stage05Payload = {
  run: {
    id: 'run-1',
    researchId: 'research-1',
    status: 'COMPLETED',
    qualificationVersion: 'contact-discovery-v1',
    policyVersion: 'contact-discovery-v1',
    promptVersion: null,
    companyCount: 3,
    processedCount: 3,
    acceptedCount: 2,
    excludedCount: 1,
    technicalFailureCount: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    publishedAt: '2026-01-01T00:01:00.000Z',
    error: null,
  },
  results: [
    result('brolistimber.eu', 'Brolis Timber', 'ACCEPTED', [
      { value: 'agne@brolis.eu', ownership: 'usable' },
      { value: 'info@brolis.eu', ownership: 'usable' },
      { value: 'gojsk@alga-wood.com', ownership: 'partner' },
    ]),
    result('nvg.lt', 'NVG', 'ACCEPTED', [
      { value: 'info@nvg.lt', ownership: 'usable' },
    ]),
    result('thermory.com', 'Thermory', 'EXCLUDED', []),
  ],
};

describe('Stage 05 contacts browser model', () => {
  it('derives retained, excluded and email totals from the payload', () => {
    const retained = payload.results.filter(
      (item) => item.decision === 'ACCEPTED',
    );
    const excluded = payload.results.filter(
      (item) => item.decision === 'EXCLUDED',
    );
    expect(stage05Totals(retained, excluded)).toEqual({
      retained: 2,
      excluded: 1,
      usableEmails: 3,
      partnerEmails: 1,
    });
  });

  it('searches by name, domain or email and keeps partner contacts separate', () => {
    const rows = buildStage05Rows(
      payload.results.filter((item) => item.decision === 'ACCEPTED'),
    );

    expect(filterStage05Rows(rows, 'bro').map((row) => row.domain)).toEqual([
      'brolistimber.eu',
    ]);
    expect(filterStage05Rows(rows, 'nvg.lt').map((row) => row.domain)).toEqual([
      'nvg.lt',
    ]);
    expect(
      filterStage05Rows(rows, 'agne@brolis.eu').map((row) => row.domain),
    ).toEqual(['brolistimber.eu']);

    const brolis = rows.find((row) => row.domain === 'brolistimber.eu');
    expect(brolis?.usableEmails.map((email) => email.value)).toEqual([
      'agne@brolis.eu',
      'info@brolis.eu',
    ]);
    expect(brolis?.partnerEmails.map((email) => email.value)).toEqual([
      'gojsk@alga-wood.com',
    ]);
    expect(
      brolis?.usableEmails.some((email) => email.value.includes('alga-wood')),
    ).toBe(false);
  });

  it('shows the actual exclusion reason', () => {
    expect(stage05ReasonLabel('EMAIL_NOT_FOUND')).toBe(
      'No usable company email found',
    );
    expect(stage05ReasonLabel('COUNTRY_MISMATCH')).toContain('target-country');
  });

  it('searches results beyond the first 100-row API page', () => {
    const many = Array.from({ length: 150 }, (_, index) => {
      const domain = `company-${index}.co`;
      return result(domain, `Company ${index}`, 'ACCEPTED', [
        { value: `user${index}@${domain}`, ownership: 'usable' },
      ]);
    });
    const rows = buildStage05Rows(many);

    expect(rows).toHaveLength(150);
    expect(stage05Totals(many, [])).toMatchObject({
      retained: 150,
      excluded: 0,
      usableEmails: 150,
    });
    expect(
      filterStage05Rows(rows, 'Company 149').map((row) => row.domain),
    ).toEqual(['company-149.co']);
    expect(
      filterStage05Rows(rows, 'user149@').map((row) => row.domain),
    ).toEqual(['company-149.co']);
  });
});
