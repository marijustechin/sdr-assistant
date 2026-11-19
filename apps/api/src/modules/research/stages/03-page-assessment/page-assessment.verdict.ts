import type { PageFacts } from './page-assessment.schema.js';
import type { PageAssessmentSpec } from './page-assessment.spec.js';

/** Why the code reached the verdict. Kept next to the verdict for review. */
export type AssessmentReason =
  | 'exact'
  | 'traits_differ'
  | 'traits_missing'
  | 'third_party'
  | 'mass_market_retailer'
  | 'publisher_unclear'
  | 'no_offer'
  | 'label_only'
  | 'market_other'
  | 'adjacent_product'
  | 'category_unknown';

export type AssessmentVerdict = 'a' | 'b' | 'none';

export type AssessmentOutcome = {
  verdict: AssessmentVerdict;
  reason: AssessmentReason;
};

/**
 * Turns the facts of one page into a/b/none.
 *
 * The order is the study's decision order: a usable source and the publisher's
 * own offer first, then the category, then the exact product. Every gate that
 * fails yields "none"; the traits only separate "a" from "b". The verdict is
 * deliberately not the model's: the same facts always produce the same answer,
 * and the rule can be changed without a new paid call.
 *
 * `traits` must contain exactly the declared trait names — the schema already
 * enforces it, and the check here keeps callers that bypass the schema from
 * producing an "a" out of a shorter list.
 */
export function deriveVerdict(
  facts: PageFacts,
  spec: PageAssessmentSpec,
): AssessmentOutcome {
  if (facts.publisher === 'third_party') {
    return { verdict: 'none', reason: 'third_party' };
  }

  if (facts.publisher === 'mass_market_retailer') {
    return { verdict: 'none', reason: 'mass_market_retailer' };
  }

  if (facts.publisher === 'unclear') {
    return { verdict: 'none', reason: 'publisher_unclear' };
  }

  if (facts.offer.evidence_type === 'none') {
    return { verdict: 'none', reason: 'no_offer' };
  }

  if (facts.offer.evidence_type === 'label_only') {
    return { verdict: 'none', reason: 'label_only' };
  }

  if (facts.market.status === 'other') {
    return { verdict: 'none', reason: 'market_other' };
  }

  if (facts.category.match === 'no') {
    return { verdict: 'none', reason: 'adjacent_product' };
  }

  if (facts.category.match === 'unknown') {
    return { verdict: 'none', reason: 'category_unknown' };
  }

  const declared = spec.traits.map((trait) => trait.name);
  const reported = Object.keys(facts.traits);
  const missing = declared.filter((name) => !reported.includes(name));
  const unexpected = reported.filter((name) => !declared.includes(name));

  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Traits do not match the study spec: missing [${missing.join(', ')}], ` +
        `unexpected [${unexpected.join(', ')}]`,
    );
  }

  const matches = declared.map((name) => facts.traits[name].match);

  if (matches.every((match) => match === 'confirmed')) {
    return { verdict: 'a', reason: 'exact' };
  }

  if (matches.includes('differs')) {
    return { verdict: 'b', reason: 'traits_differ' };
  }

  return { verdict: 'b', reason: 'traits_missing' };
}
