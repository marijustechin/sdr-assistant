import { describe, expect, it } from 'vitest';

import { DEFAULT_LEAD_QUALIFICATION_LIMITS } from '../../src/modules/lead-qualification/lead-qualification.constants.js';
import {
  LeadQualificationEngine,
  RunBudget,
} from '../../src/modules/lead-qualification/lead-qualification.engine.js';
import { parseResearchSource } from '../../src/modules/lead-qualification/lead-qualification.input.js';
import { RunWideError } from '../../src/modules/lead-qualification/lead-qualification.types.js';
import {
  FakeDiscovery,
  FakeSemantic,
  FakeWebsite,
  discoveryResult,
  researchRecord,
  semanticAssessment,
  sourceCompany,
  websiteCheck,
} from './helpers.js';

function fixture(company = sourceCompany()) {
  const study = parseResearchSource(researchRecord([company]), 10_000_000);
  const context = {
    study,
    limits: DEFAULT_LEAD_QUALIFICATION_LIMITS,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  return { company, study, context };
}

function run(
  website = websiteCheck(),
  discovery = discoveryResult(),
  semantic = semanticAssessment(),
) {
  const websiteFake = new FakeWebsite(website);
  const discoveryFake = new FakeDiscovery(discovery);
  const semanticFake = new FakeSemantic(semantic);
  const engine = new LeadQualificationEngine(
    websiteFake,
    discoveryFake,
    semanticFake,
    DEFAULT_LEAD_QUALIFICATION_LIMITS,
  );
  return { engine, websiteFake, discoveryFake, semanticFake };
}

describe('SDR-007A mandatory qualification engine', () => {
  it('accepts a company when every deterministic gate passes without an LLM call', async () => {
    const { company, context } = fixture();
    const { engine, semanticFake, discoveryFake } = run();
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('ACCEPTED');
    expect(result.exclusionReasons).toEqual([]);
    expect(semanticFake.calls).toBe(0);
    expect(discoveryFake.calls).toBe(0);
  });

  it('excludes an HTTP-only website before expensive discovery or LLM', async () => {
    const { company, context } = fixture();
    const { engine, semanticFake, discoveryFake } = run(
      websiteCheck({
        status: 'FAIL',
        reason: 'NO_VALID_HTTPS',
        https: false,
        certificateValid: false,
        failureKind: 'http_only',
      }),
    );
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('EXCLUDED');
    expect(result.primaryExclusionReason).toBe('NO_VALID_HTTPS');
    expect(discoveryFake.calls).toBe(0);
    expect(semanticFake.calls).toBe(0);
  });

  it('excludes foreign address plus foreign telephone without discovery', async () => {
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
    const { context } = fixture(company);
    const { engine, discoveryFake, semanticFake } = run();
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('EXCLUDED');
    expect(result.primaryExclusionReason).toBe('COUNTRY_MISMATCH');
    expect(discoveryFake.calls).toBe(0);
    expect(semanticFake.calls).toBe(0);
  });

  it('accepts a target-country address with no telephone', async () => {
    const company = sourceCompany({ phones: [] });
    const { context } = fixture(company);
    const { engine } = run();
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('ACCEPTED');
  });

  it('performs geographic discovery even when an email already exists', async () => {
    const company = sourceCompany();
    const { context } = fixture(company);
    const { engine, discoveryFake } = run(
      websiteCheck({ bodyText: 'Welcome. Contact us by email.' }),
      discoveryResult({
        localAddressEvidence: [
          {
            url: 'https://alpha.test/imprint',
            kind: 'address',
            quote: 'Test Street 1, Vilnius, Lithuania',
            source: 'http',
            observedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    const result = await engine.qualify(
      company,
      context,
      new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS),
    );
    expect(discoveryFake.calls).toBe(1);
    expect(result.checks.geography.status).toBe('PASS');
    expect(result.decision).toBe('ACCEPTED');
  });

  it('discovers a missing email and accepts with source evidence', async () => {
    const company = sourceCompany({ emails: [] });
    const { context } = fixture(company);
    const { engine, discoveryFake } = run(
      websiteCheck(),
      discoveryResult({
        emails: [
          {
            value: 'info@alpha.test',
            role: 'general',
            sourceUrl: 'https://alpha.test/contact',
            discoveredBy: 'contact-page',
          },
        ],
      }),
    );
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('ACCEPTED');
    expect(discoveryFake.calls).toBe(1);
    expect(result.contacts.emails.map((email) => email.value)).toContain('info@alpha.test');
  });

  it('excludes with EMAIL_NOT_FOUND after exhausted discovery', async () => {
    const company = sourceCompany({ emails: [] });
    const { context } = fixture(company);
    const { engine, semanticFake } = run(websiteCheck(), discoveryResult());
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('EXCLUDED');
    expect(result.primaryExclusionReason).toBe('EMAIL_NOT_FOUND');
    expect(semanticFake.calls).toBe(0);
  });

  it('uses one semantic call for ambiguous category-only relevance', async () => {
    const company = sourceCompany({
      offers: [
        {
          id: 'offer-1',
          item: 'Adjacent category item',
          verdict: 'b',
          sourceUrl: 'https://alpha.test/product',
        },
      ],
    });
    const { context } = fixture(company);
    const { engine, semanticFake } = run();
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('ACCEPTED');
    expect(semanticFake.calls).toBe(1);
    expect(result.metadata.llmCalls).toBe(1);
  });

  it('resolves conflicting geography through bounded discovery evidence', async () => {
    const company = sourceCompany({
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
    });
    const { context } = fixture(company);
    const { engine } = run(
      websiteCheck(),
      discoveryResult({
        localAddressEvidence: [
          {
            url: 'https://alpha.test/imprint',
            kind: 'address',
            quote: 'Vilnius office',
            source: 'http',
            observedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        localBranchEvidence: [
          {
            url: 'https://alpha.test/imprint',
            kind: 'address',
            quote: 'Vilnius office branch',
            source: 'http',
            observedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('ACCEPTED');
  });

  it('does not let semantic acceptance override a confirmed relevance failure', async () => {
    const company = sourceCompany({ offers: [] });
    const { context } = fixture(company);
    const { engine, semanticFake, discoveryFake } = run();
    const result = await engine.qualify(
      company,
      context,
      new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS),
    );
    expect(result.decision).toBe('EXCLUDED');
    expect(result.primaryExclusionReason).toBe('IRRELEVANT_BUSINESS');
    expect(semanticFake.calls).toBe(0);
    expect(discoveryFake.calls).toBe(0);
  });

  it('accepts an active commercial page containing a coming-soon announcement', async () => {
    const { company, context } = fixture();
    const { engine, semanticFake } = run(
      websiteCheck({
        bodyText:
          'Coming soon: new products. Contact our sales team, browse the product catalogue and shop online. Test Street 1, Vilnius, Lithuania.',
      }),
    );
    const result = await engine.qualify(
      company,
      context,
      new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS),
    );
    expect(result.checks.activity.status).toBe('PASS');
    expect(result.decision).toBe('ACCEPTED');
    expect(semanticFake.calls).toBe(0);
  });

  it('propagates a run-wide discovery provider failure', async () => {
    const company = sourceCompany({ emails: [] });
    const { context } = fixture(company);
    const { engine } = run(
      websiteCheck(),
      new RunWideError('SEARCH_PROVIDER_OUTAGE', 'synthetic outage'),
    );
    await expect(
      engine.qualify(
        company,
        context,
        new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS),
      ),
    ).rejects.toBeInstanceOf(RunWideError);
  });

  it('discovers geography when the persisted profile has no address', async () => {
    const company = sourceCompany({
      address: null,
      city: null,
      country: null,
      phones: [],
    });
    const { context } = fixture(company);
    const { engine } = run(
      websiteCheck({ bodyText: 'Welcome. Contact us by email.' }),
      discoveryResult({
        localAddressEvidence: [
          {
            url: 'https://alpha.test/imprint',
            kind: 'address',
            quote: 'Test Street 1, Vilnius, Lithuania',
            source: 'http',
            observedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    const result = await engine.qualify(
      company,
      context,
      new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS),
    );
    expect(result.decision).toBe('ACCEPTED');
    expect(result.checks.geography.localPresence).toBe(true);
  });

  it('records a failed semantic attempt as a usage-consuming technical failure', async () => {
    const company = sourceCompany({
      offers: [
        {
          id: 'offer-1',
          item: 'Adjacent category item',
          verdict: 'b',
          sourceUrl: 'https://alpha.test/product',
        },
      ],
    });
    const { context } = fixture(company);
    const failingSemantic = {
      async assess(): Promise<never> {
        throw new Error('synthetic semantic provider failure');
      },
    };
    const engine = new LeadQualificationEngine(
      new FakeWebsite(websiteCheck()),
      new FakeDiscovery(discoveryResult()),
      failingSemantic as never,
      DEFAULT_LEAD_QUALIFICATION_LIMITS,
    );
    const budget = new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS);
    const result = await engine.qualify(company, context, budget);
    expect(result.decision).toBe('EXCLUDED');
    expect(result.metadata.technicalFailure).toBe(true);
    expect(result.metadata.llmCalls).toBe(1);
    expect(budget.usage.llmCalls).toBe(1);
  });

  it('keeps unresolved geographic evidence out of acceptance', async () => {
    const company = sourceCompany({
      address: null,
      city: null,
      country: null,
      phones: [],
    });
    const { context } = fixture(company);
    const { engine } = run(
      websiteCheck(),
      discoveryResult(),
      semanticAssessment({ geography: 'unclear', geographyEvidence: [] }),
    );
    const result = await engine.qualify(company, context, new RunBudget(DEFAULT_LEAD_QUALIFICATION_LIMITS));
    expect(result.decision).toBe('EXCLUDED');
    expect(result.checks.geography.status).not.toBe('PASS');
  });
});
