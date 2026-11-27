import { describe, expect, it } from 'vitest';

import {
  buildGeographySignals,
  evaluateGeography,
  extractAddressEvidence,
  extractCountryCodes,
  normalisePhone,
  phoneCountryCandidates,
  resolveCountryCode,
} from '../../src/modules/lead-qualification/lead-qualification.geography.js';
import { sourceCompany } from './helpers.js';

function withLocalAddress(
  company = sourceCompany(),
  targetCountryCode = 'LT',
) {
  const signals = buildGeographySignals(company, targetCountryCode);
  const evidence = extractAddressEvidence(
    'https://alpha.test/contact',
    `Alpha UAB, ${company.address ?? ''}, ${company.city ?? ''}, Lithuania`,
    company,
    targetCountryCode,
  );
  return { ...signals, localAddressEvidence: evidence.local };
}

describe('SDR-007A geographic gates', () => {
  it('passes a source-backed target address with a matching local telephone', () => {
    const signals = withLocalAddress();
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('PASS');
    expect(check.addressCountry).toBe('LT');
    expect(check.phoneCountries).toContain('LT');
  });

  it('passes a source-backed target address with no published telephone', () => {
    const signals = withLocalAddress(sourceCompany({ phones: [] }));
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('PASS');
    expect(check.detail).toMatch(/address/);
  });

  it('excludes a foreign address with a matching foreign telephone', () => {
    const signals = buildGeographySignals(
      sourceCompany({
        address: 'Teststrasse 1',
        city: 'Berlin',
        country: 'Germany',
        phones: [
          {
            value: '+4930123456',
            normalised: '+4930123456',
            label: null,
            sourceUrl: 'https://alpha.test/contact',
          },
        ],
      }),
      'LT',
    );
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('FAIL');
    expect(check.reason).toBe('COUNTRY_MISMATCH');
    expect(check.foreignPresence).toBe(true);
  });

  it('does not turn target-country shipping text into local address evidence', () => {
    const company = sourceCompany({
      address: 'Teststrasse 1',
      city: 'Berlin',
      country: 'Germany',
      phones: [
        {
          value: '+4930123456',
          normalised: '+4930123456',
          label: null,
          sourceUrl: 'https://alpha.test/contact',
        },
      ],
    });
    const evidence = extractAddressEvidence(
      'https://alpha.test/imprint',
      'Teststrasse 1, Berlin, Germany. Shipping to Lithuania.',
      company,
      'LT',
    );
    expect(evidence.local).toHaveLength(0);
    expect(evidence.foreign.length).toBeGreaterThan(0);
    const check = evaluateGeography(
      {
        ...buildGeographySignals(company, 'LT'),
        foreignAddressEvidence: evidence.foreign,
        foreignAddressCountries: evidence.foreignCountries,
      },
      'LT',
    );
    expect(check.status).toBe('FAIL');
    expect(check.reason).toBe('COUNTRY_MISMATCH');
  });

  it('requires discovery when only a local telephone is known', () => {
    const signals = buildGeographySignals(
      sourceCompany({ address: null, city: null, country: null }),
      'LT',
    );
    const unresolved = evaluateGeography(signals, 'LT');
    expect(unresolved.status).toBe('UNKNOWN');
    const attempted = evaluateGeography(
      { ...signals, discoveryAttempted: true },
      'LT',
    );
    expect(attempted.status).toBe('FAIL');
    expect(attempted.reason).toBe('COUNTRY_UNCONFIRMED');
  });

  it('requires discovery for conflicting address and telephone countries', () => {
    const signals = buildGeographySignals(
      sourceCompany({
        address: 'Teststrasse 1',
        city: 'Berlin',
        country: 'Germany',
        phones: [
          {
            value: '+37060000000',
            normalised: '+37060000000',
            label: null,
            sourceUrl: 'https://alpha.test/contact',
          },
        ],
      }),
      'LT',
    );
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('UNKNOWN');
    expect(check.conflict).toBe(true);
  });

  it('passes a verified local branch even when the profile is foreign', () => {
    const signals = buildGeographySignals(
      sourceCompany({ address: 'Teststrasse 1', city: 'Berlin', country: 'Germany' }),
      'LT',
    );
    signals.localBranchEvidence = [
      {
        url: 'https://alpha.test/branch',
        kind: 'address',
        quote: 'Vilnius branch',
        source: 'semantic',
        observedAt: new Date().toISOString(),
      },
    ];
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('PASS');
  });

  it('treats a shared calling code as ambiguous, not local proof', () => {
    const signals = buildGeographySignals(
      sourceCompany({
        address: '5 Test Ave',
        city: 'New York',
        country: 'United States',
        phones: [
          {
            value: '+14155550123',
            normalised: '+14155550123',
            label: null,
            sourceUrl: 'https://alpha.test/contact',
          },
        ],
      }),
      'US',
    );
    const check = evaluateGeography(signals, 'US');
    expect(check.status).not.toBe('PASS');
    expect(phoneCountryCandidates('+14155550123').length).toBeGreaterThan(1);
  });

  it('normalises only reliable international numbers', () => {
    expect(normalisePhone('+370 600 00000')).toBe('+37060000000');
    expect(normalisePhone('00370 600 00000')).toBe('+37060000000');
    expect(normalisePhone('8 600 00000')).toBeNull();
    expect(extractCountryCodes('Vilnius, Lietuva')).toContain('LT');
  });

  it('does not treat a standalone two-letter word as an ISO country code', () => {
    expect(extractCountryCodes('Building LT 5, Room 2')).not.toContain('LT');
    expect(extractCountryCodes('Vilnius, Lithuania')).toContain('LT');
    expect(resolveCountryCode('LT')).toBe('LT');
  });

  it('does not describe stored address/country fields as verified evidence', () => {
    const signals = buildGeographySignals(sourceCompany(), 'LT');
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('UNKNOWN');
    expect(signals.targetAddress).toBe(false);
    expect(signals.localAddressEvidence).toEqual([]);
  });

  it('does not use an unsourced telephone as geographic proof', () => {
    const signals = buildGeographySignals(
      sourceCompany({
        phones: [
          {
            value: '+37060000000',
            normalised: '+37060000000',
            label: 'sales',
            sourceUrl: null,
          },
        ],
      }),
      'LT',
    );
    expect(signals.phones).toEqual([]);
  });

  it('treats a different foreign telephone country as conflicting evidence', () => {
    const signals = buildGeographySignals(
      sourceCompany({
        address: 'Teststrasse 1',
        city: 'Berlin',
        country: 'Germany',
        phones: [
          {
            value: '+33123456789',
            normalised: '+33123456789',
            label: null,
            sourceUrl: 'https://alpha.test/contact',
          },
        ],
      }),
      'LT',
    );
    const check = evaluateGeography(signals, 'LT');
    expect(check.status).toBe('UNKNOWN');
    expect(check.conflict).toBe(true);
  });
});
