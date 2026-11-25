import type { PageAssessmentResult } from '../03-page-assessment/page-assessment-result.js';
import { isInsufficientBalanceError } from '../../lib/llm-chat.js';
import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import {
  prepareProfilingInput,
  type CompanyProfilingInput,
  type HomepageScraper,
  type ProfilingDomainInput,
  type ProfilingOffer,
} from './company-profiling.input.js';
import {
  runFirstCall,
  type DroppedItem,
  type FirstCallChat,
  type FirstCallResult,
} from './company-profiling.first-call.js';
import {
  describeGaps,
  fillProfilingGaps,
  planGapFill,
  type GapPlan,
  type SecondCallPage,
} from './company-profiling.gap-fill.js';
import { deriveMarket } from './company-profiling.market.js';
import { COMPANY_PROFILING_PROMPT_VERSION } from './company-profiling.prompt.js';
import { buildCompanyProfile } from './company-profiling.profile.js';
import type {
  CompanyProfile,
  CompanyProfileError,
  CompanyProfileOffer,
  DomainUsage,
} from './company-profiling.types.js';

type DomainEntry = PageAssessmentResult['domains'][number];

export type ProfilingBatchSummary = {
  domains: number;
  /** Domains taken from an already saved profile, not reprocessed. */
  reused: number;
  /** Processed domains that needed no second LLM call. */
  firstCallOnly: number;
  /** Processed domains where the second call succeeded. */
  secondCall: number;
  /** Gaps existed and the second call failed; profile fell back to 04.2. */
  secondCallFailed: number;
  /** Domains without a usable profile after processing. */
  errors: number;
  /** New fetches and LLM calls only; reused domains add zero. */
  newFetches: number;
  newLlmCalls: number;
  newPromptTokens: number;
  newCompletionTokens: number;
};

export type GapOutcome =
  | 'reused'
  | 'no-gap'
  | 'no-page'
  | 'fetch-failed'
  | 'short-content'
  | 'second-call'
  | 'second-call-failed'
  | 'error';

export type DomainDiagnostic = {
  domain: string;
  reused: boolean;
  status: CompanyProfile['status'];
  /** Gap flags after 04.2; null when 04.2 did not produce a result. */
  gapsAfterFirst: { market: boolean; contact: boolean } | null;
  /** Gap flags after 04.3 (or the same as after 04.2 when it did not run). */
  gapsAfter: { market: boolean; contact: boolean } | null;
  /** Every link 04.1 supplied, so a missing link is visible. */
  links: Array<{
    id: string;
    url: string;
    kind: 'contact';
  }>;
  /** The gap pages 04.3 planned to fetch. */
  selectedPages: Array<{
    kind: 'contact';
    url: string;
  }>;
  secondCall: GapOutcome;
  reason: string;
  /** The exact capped text passed to the second LLM call, if it ran. */
  newPages: SecondCallPage[];
  /** Raw second answer; empty when the second call did not run. */
  secondRaw: string;
  dropped: DroppedItem[];
  fetches: number;
  llmCalls: number;
};

export type CompanyProfilingResult = {
  promptVersion: string;
  createdAt: string;
  targetCountry: string;
  targetLanguage: string;
  product: PageAssessmentResult['product'];
  /** One profile per input domain, in input order. */
  domains: CompanyProfile[];
  /** One entry per domain, explaining how far 04.3 went and why it stopped. */
  diagnostics: DomainDiagnostic[];
  summary: ProfilingBatchSummary;
};

export type ProfileAllDeps = {
  scrape: HomepageScraper;
  chat: FirstCallChat;
  /** Domains already processed and paid for in an earlier run. */
  precomputed?: ReadonlyMap<string, CompanyProfile>;
};

type DomainOutcome = {
  kind: 'first' | 'second' | 'second_failed' | 'error';
  profile: CompanyProfile;
  diagnostic: DomainDiagnostic;
};

/**
 * The normal 04 entry: 04.1 → 04.2 → (04.3 when gaps remain) → 04.4 for every
 * domain. A domain with no gaps goes straight from the first call to 04.4; a
 * failing domain becomes an explicit `error` profile and never aborts the rest
 * of the batch, except for an exhausted provider balance.
 */
export async function profileAll(
  data: PageAssessmentResult,
  deps: ProfileAllDeps,
  onStage?: (stage: string) => Promise<void>,
): Promise<CompanyProfilingResult> {
  const domains: CompanyProfile[] = [];
  const diagnostics: DomainDiagnostic[] = [];
  const summary: ProfilingBatchSummary = {
    domains: 0,
    reused: 0,
    firstCallOnly: 0,
    secondCall: 0,
    secondCallFailed: 0,
    errors: 0,
    newFetches: 0,
    newLlmCalls: 0,
    newPromptTokens: 0,
    newCompletionTokens: 0,
  };

  for (const [index, entry] of data.domains.entries()) {
    const precomputed = deps.precomputed?.get(entry.domain);

    if (precomputed) {
      domains.push(precomputed);
      diagnostics.push({
        domain: precomputed.domain,
        reused: true,
        status: precomputed.status,
        gapsAfterFirst: null,
        gapsAfter: null,
        links: [],
        selectedPages: [],
        secondCall: 'reused',
        reason: 'Reused a saved profile; no new fetch or LLM call.',
        newPages: [],
        secondRaw: '',
        dropped: [],
        fetches: 0,
        llmCalls: 0,
      });
      summary.reused += 1;
      await onStage?.(
        `04 Reusing saved profile ${entry.domain} (${index + 1}/${data.domains.length})`,
      );
      continue;
    }

    await onStage?.(
      `04 Profiling ${entry.domain} (${index + 1}/${data.domains.length})`,
    );

    const outcome = await profileDomain(entry, data, deps, onStage);

    domains.push(outcome.profile);
    diagnostics.push(outcome.diagnostic);

    if (outcome.kind === 'first') summary.firstCallOnly += 1;
    else if (outcome.kind === 'second') summary.secondCall += 1;
    else if (outcome.kind === 'second_failed') summary.secondCallFailed += 1;
    else summary.errors += 1;

    summary.newFetches += outcome.profile.usage.fetches;
    summary.newLlmCalls += outcome.profile.usage.llmCalls;
    summary.newPromptTokens += outcome.profile.usage.promptTokens ?? 0;
    summary.newCompletionTokens += outcome.profile.usage.completionTokens ?? 0;
  }

  summary.domains = domains.length;

  return {
    promptVersion: COMPANY_PROFILING_PROMPT_VERSION,
    createdAt: new Date().toISOString(),
    targetCountry: data.targetCountry,
    targetLanguage: data.targetLanguage,
    product: data.product,
    domains,
    diagnostics,
    summary,
  };
}

async function profileDomain(
  entry: DomainEntry,
  data: PageAssessmentResult,
  deps: ProfileAllDeps,
  onStage?: (stage: string) => Promise<void>,
): Promise<DomainOutcome> {
  const startedAt = Date.now();
  let input: CompanyProfilingInput | null = null;
  let capturedSecondCallPages: SecondCallPage[] = [];

  try {
    input = await prepareProfilingInput(data, deps.scrape, onStage, {
      onlyDomains: [entry.domain],
    });
    const domain = input.domains[0];

    if (!domain) throw new Error(`Domain not found after 04.1: ${entry.domain}`);

    if (domain.error) {
      const profile = errorProfile(
        domain,
        domain.error.code,
        domain.error.message,
        fetchCount(domain),
        Date.now() - startedAt,
        0,
      );

      return {
        kind: 'error',
        profile,
        diagnostic: diagnosticFor(
          profile,
          null,
          null,
          domain.links,
          [],
          'error',
          `04.1 failed: ${domain.error.code} — ${domain.error.message}`,
          [],
        ),
      };
    }

    const first = await runFirstCall(
      {
        targetCountry: input.targetCountry,
        targetLanguage: input.targetLanguage,
        product: input.product,
        domain,
        model: LLM_CONFIG_FLASH.model,
      },
      deps.chat,
    );
    const plan = planGapFill(domain, first);
    const gapsAfterFirst = { market: plan.market, contact: plan.contact };

    const firstProfile = () =>
      buildCompanyProfile(first, {
        usage: { first: first.usage, second: null },
        fetches: fetchCount(domain),
        durationMs: Date.now() - startedAt,
      });

    if (!plan.market && !plan.contact) {
      const profile = firstProfile();

      return {
        kind: 'first',
        profile,
        diagnostic: diagnosticFor(
          profile,
          gapsAfterFirst,
          gapsAfterFirst,
          plan.links,
          [],
          'no-gap',
          '04.2 left neither a market nor a contact gap.',
          first.dropped,
        ),
      };
    }

    if (plan.pages.length === 0) {
      const profile = firstProfile();

      return {
        kind: 'first',
        profile,
        diagnostic: diagnosticFor(
          profile,
          gapsAfterFirst,
          gapsAfterFirst,
          plan.links,
          [],
          'no-page',
          noPageReason(plan),
          first.dropped,
        ),
      };
    }

    try {
      const gap = await fillProfilingGaps(
        input,
        first,
        deps.scrape,
        deps.chat,
        onStage,
        (secondCall) => {
          capturedSecondCallPages = secondCall.newPages;
        },
      );
      const profile = buildCompanyProfile(gap.after, {
        usage: {
          first: first.usage,
          second: gap.usage.second,
        },
        fetches: fetchCount(domain) + gap.additionalFetches,
        durationMs: Date.now() - startedAt,
      });
      const gapsAfter = describeGaps(gap.after);
      const { secondCall, reason } = classifyGap(gap);

      return {
        kind: gap.additionalLlmCalls > 0 ? 'second' : 'first',
        profile,
        diagnostic: diagnosticFor(
          profile,
          gapsAfterFirst,
          gapsAfter,
          plan.links,
          plan.pages,
          secondCall,
          reason,
          gap.dropped,
          capturedSecondCallPages.length > 0
            ? capturedSecondCallPages
            : gap.newPages,
          gap.secondRaw,
        ),
      };
    } catch (cause) {
      if (isInsufficientBalanceError(cause)) throw cause;

      const profile = {
        ...buildCompanyProfile(first, {
          usage: { first: first.usage, second: null },
          fetches: fetchCount(domain) + plan.pages.length,
          durationMs: Date.now() - startedAt,
        }),
        error: {
          code: 'llm_failed' as const,
          message: messageOf(cause),
        },
      };

      return {
        kind: 'second_failed',
        profile,
        diagnostic: diagnosticFor(
          profile,
          gapsAfterFirst,
          gapsAfterFirst,
          plan.links,
          plan.pages,
          'second-call-failed',
          `Second call failed: ${messageOf(cause)}`,
          first.dropped,
          capturedSecondCallPages,
        ),
      };
    }
  } catch (cause) {
    if (isInsufficientBalanceError(cause)) throw cause;

    const base = input?.domains[0] ?? null;
    const profile = base
      ? errorProfile(
          base,
          'llm_failed',
          messageOf(cause),
          fetchCount(base),
          Date.now() - startedAt,
          1,
        )
      : errorProfileFromEntry(
          entry,
          'llm_failed',
          messageOf(cause),
          Date.now() - startedAt,
        );

    return {
      kind: 'error',
      profile,
      diagnostic: diagnosticFor(
        profile,
        null,
        null,
        base?.links ?? [],
        [],
        'error',
        `Domain failed: ${messageOf(cause)}`,
        [],
      ),
    };
  }
}

export function noPageReason(plan: GapPlan): string {
  const contact = plan.links.filter((link) => link.kind === 'contact').length;
  const parts: string[] = [];

  if (plan.contact) {
    parts.push('Contact gap remains; no contact link selected.');
  }

  if (contact > 0) {
    parts.push(`${linkPhrase(contact, 'contact link')} was available.`);
  } else {
    parts.push('No contact link was available.');
  }

  return parts.join(' ');
}

function linkPhrase(count: number, noun: string): string {
  const number = count === 1 ? 'One' : String(count);

  return `${number} ${noun}${count === 1 ? '' : 's'}`;
}

type GapResult = Awaited<ReturnType<typeof fillProfilingGaps>>;

function classifyGap(gap: GapResult): {
  secondCall: GapOutcome;
  reason: string;
} {
  if (gap.additionalLlmCalls > 0) {
    const after = describeGaps(gap.after);
    const remaining = [
      after.market ? 'market' : null,
      after.contact ? 'contact' : null,
    ].filter((item): item is string => item !== null);

    return {
      secondCall: 'second-call',
      reason:
        remaining.length > 0
          ? `Second call ran; remaining gaps: ${remaining.join(', ')}.`
          : 'Second call ran and closed both gaps.',
    };
  }

  const failed = gap.pages.filter((page) => page.error !== null);
  const chars = gap.pages.reduce((sum, page) => sum + page.chars, 0);

  if (failed.length > 0 && failed.length === gap.pages.length) {
    return {
      secondCall: 'fetch-failed',
      reason: `Gap page fetch failed: ${failed
        .map((page) => `${page.url}: ${page.error}`)
        .join('; ')}`,
    };
  }

  if (chars < 200) {
    return {
      secondCall: 'short-content',
      reason: `Fetched ${chars} characters (<200); second call skipped.`,
    };
  }

  return {
    secondCall: 'no-page',
    reason: 'No usable gap page; second call skipped.',
  };
}

function diagnosticFor(
  profile: CompanyProfile,
  gapsAfterFirst: { market: boolean; contact: boolean } | null,
  gapsAfter: { market: boolean; contact: boolean } | null,
  links: ProfilingDomainInput['links'],
  selectedPages: Array<{ kind: 'contact'; url: string }>,
  secondCall: GapOutcome,
  reason: string,
  dropped: DroppedItem[],
  newPages: SecondCallPage[] = [],
  secondRaw = '',
): DomainDiagnostic {
  return {
    domain: profile.domain,
    reused: false,
    status: profile.status,
    gapsAfterFirst,
    gapsAfter,
    links: links.map(({ id, url, kind }) => ({ id, url, kind })),
    selectedPages,
    secondCall,
    reason,
    newPages,
    secondRaw,
    dropped,
    fetches: profile.usage.fetches,
    llmCalls: profile.usage.llmCalls,
  };
}

function fetchCount(domain: ProfilingDomainInput): number {
  return (
    domain.fetchAttempts ??
    (domain.homepage?.source === 'scrape' ? 1 : 0)
  );
}

function errorProfile(
  domain: ProfilingDomainInput,
  code: CompanyProfileError['code'],
  message: string,
  fetches: number,
  durationMs: number,
  llmCalls: number,
): CompanyProfile {
  return errorProfileFromOffers(domain.domain, domain.offers, code, message, {
    llmCalls,
    promptTokens: null,
    completionTokens: null,
    fetches,
    fetchCredits: null,
    durationMs,
  });
}

function errorProfileFromEntry(
  entry: DomainEntry,
  code: CompanyProfileError['code'],
  message: string,
  durationMs: number,
): CompanyProfile {
  return errorProfileFromOffers(
    entry.domain,
    offersFromEntry(entry),
    code,
    message,
    {
      llmCalls: 0,
      promptTokens: null,
      completionTokens: null,
      fetches: 0,
      fetchCredits: null,
      durationMs,
    },
  );
}

function errorProfileFromOffers(
  domain: string,
  offers: readonly ProfilingOffer[],
  code: CompanyProfileError['code'],
  message: string,
  usage: DomainUsage,
): CompanyProfile {
  return {
    domain,
    registrableDomain: domain.replace(/^www\./i, '').toLowerCase(),
    status: 'error',
    error: { code, message },
    company: {
      name: null,
      legalName: null,
      code: null,
      vat: null,
      address: null,
      city: null,
      country: null,
      emails: [],
      phones: [],
      contactFormUrl: null,
      sources: [],
    },
    offers: offers.map((offer) => toProfileOffer(offer)),
    usage,
  };
}

function toProfileOffer(offer: ProfilingOffer): CompanyProfileOffer {
  return {
    id: offer.id,
    item: offer.item,
    verdict: offer.verdict,
    traits: { ...offer.traits },
    pageIds: [offer.id],
    sourceUrl: offer.sourceUrl,
    marketFrom03: offer.marketFrom03,
    market: deriveMarket(offer.id, []),
    prices: [],
  };
}

function offersFromEntry(entry: DomainEntry): ProfilingOffer[] {
  return entry.pages.map((page, index) => ({
    id: `03-${String(index + 1).padStart(4, '0')}`,
    item: page.facts.offer.item ?? page.page.title ?? '',
    verdict: page.verdict,
    traits: Object.fromEntries(
      Object.entries(page.facts.traits).map(([name, trait]) => [
        name,
        trait.match,
      ]),
    ),
    marketFrom03: {
      status: page.facts.market.status,
      note: page.facts.market.note?.trim() || null,
      sourceUrl: page.page.url,
      quote: null,
    },
    quote: page.facts.offer.quote,
    sourceUrl: page.page.url,
  }));
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
