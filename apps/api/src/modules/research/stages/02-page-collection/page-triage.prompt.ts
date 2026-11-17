/**
 * Prompt versions kept side by side so a change can be reverted by swapping the
 * two exported constants at the bottom of this file.
 *
 * v15 — literal rule 2: the page had to contain every word of
 * generalCategoryName. Known-good baseline (52 domains, 5 "a"), but loses
 * sellers that call the product "plokštė" / "elementas" and breaks whenever 01
 * words the category differently.
 *
 * v16 — semantic rule 2 (product or category, synonyms and form words allowed).
 * Tried on 2026-11-17: it lowered precision of rule 1 instead — descriptive
 * category pages of real sellers were read as "article/guide" (pata.lt, nvg.lt
 * dropped) and foreign shops entered (steamsaunabath.com, saunainter.com).
 * Good count fell 93 -> 91, "a" stayed at 5, emails 91 -> 79.
 *
 * v17 — v15 plus one rule 1 sentence: a listing on a third-party platform is not
 * the seller's own offer. The only part of v16 that demonstrably helped
 * (skelbiu.lt), without touching rule 2.
 */
export const PAGE_TRIAGE_PROMPT_V15 = `
You decide whether ONE web page is a usable candidate for B2B prospect discovery.

Input:
- targetCountry;
- generalCategoryName: the broader local product category;
- page URL, title and text.

Apply the rules in the order given and stop at the first rule that applies.

1. EXCLUDED SOURCE — verdict "none": journals, news sites, dictionaries and
   terminology pages, articles, guides and how-to pages, classifieds,
   directories, price-comparison sites, third-party marketplaces, mass-market
   retail chains, or pages without a seller or commercial offer.
   A mass-market retail chain or general-purpose store sells many unrelated
   departments (building materials, household goods, garden, tools); exclude it
   even when the page itself lists the relevant category.
   A blog post, article or guide is an excluded source even when it is published
   on a company website: being on a seller's domain does not turn an article
   into an offer.

2. GENERAL CATEGORY — if the page contains every word of the
   generalCategoryName, verdict "good".

3. Otherwise verdict "none".

A name is contained when all of its words appear in the page text, in any order
and in any grammatical form, with other words allowed between them.

Matching is literal: a word that appears only in another language, or only as a
synonym, is not a match.

When the retrieved text is missing or cut short, use the title and text you were
given and never assume content you cannot see.

For verdict "good", set reason to null and set evidence to the exact substring of
the page text in which the generalCategoryName occurs. For verdict "none", set
evidence to null and state in reason which rule decided it and, when rule 2
decided it, which word of the name was missing.

Return JSON only with exactly these fields:
{"verdict": "good" | "none", "evidence": <verbatim quote or null>,
 "reason": <short English note for "none", else null>}
`.trim();

export const PAGE_TRIAGE_PROMPT_V16 = `
You decide whether ONE web page is a usable candidate for B2B prospect discovery.

Input:
- targetCountry: the market the research is for;
- productName: the exact local product name;
- categoryName: the local category a seller of this product would use;
- generalCategoryName: the broader local category;
- description: the source product description, may be empty;
- page URL, title and text.

Apply the rules in the order given and stop at the first rule that applies.

1. EXCLUDED SOURCE — verdict "none": journals, news sites, dictionaries and
   terminology pages, articles, guides and how-to pages, classifieds,
   directories, price-comparison sites, third-party marketplaces, mass-market
   retail chains, or pages without a seller or commercial offer.
   A mass-market retail chain or general-purpose store sells many unrelated
   departments (building materials, household goods, garden, tools); exclude it
   even when the page itself lists the relevant category.
   A blog post, article or guide is an excluded source even when it is published
   on a company website: being on a seller's domain does not turn an article
   into an offer.
   An advert or a listing published on a third-party platform is not the
   seller's own commercial offer.

2. PRODUCT OR CATEGORY — verdict "good" when the page offers the product named
   by productName, or offers products of the category named by categoryName or
   generalCategoryName.

   Judge what the page offers, not the exact wording it uses. Sellers name the
   same product differently: board, panel, element, profile, slat, lining
   (lenta, plokštė, elementas, profilis, juosta, dailylentė). Any grammatical
   form counts, in the market's language. Material, species and treatment words
   strengthen the match but their absence does not fail it when the page clearly
   offers the same product type.

   A different material or construction than the product's own can still belong
   to the same category. That is a question for later stages; it is not a reason
   to drop the page here.

3. Otherwise verdict "none".

The offer decides, not the mention: a page that only names the product or the
category in passing, while its own offer is something else, is "none".

When the retrieved text is missing or cut short, use the title and text you were
given and never assume content you cannot see.

For verdict "good", set reason to null and set evidence to the exact substring of
the page text that shows the product or category offer. For verdict "none", set
evidence to null and state in reason which rule decided it.

Return JSON only with exactly these fields:
{"verdict": "good" | "none", "evidence": <verbatim quote or null>,
 "reason": <short English note for "none", else null>}
`.trim();

export const PAGE_TRIAGE_PROMPT_V17 = `
You decide whether ONE web page is a usable candidate for B2B prospect discovery.

Input:
- targetCountry;
- generalCategoryName: the broader local product category;
- page URL, title and text.

Apply the rules in the order given and stop at the first rule that applies.

1. EXCLUDED SOURCE — verdict "none": journals, news sites, dictionaries and
   terminology pages, articles, guides and how-to pages, classifieds,
   directories, price-comparison sites, third-party marketplaces, mass-market
   retail chains, or pages without a seller or commercial offer.
   A mass-market retail chain or general-purpose store sells many unrelated
   departments (building materials, household goods, garden, tools); exclude it
   even when the page itself lists the relevant category.
   A blog post, article or guide is an excluded source even when it is published
   on a company website: being on a seller's domain does not turn an article
   into an offer.
   An advert or a listing published on a third-party platform is not the
   seller's own commercial offer.

2. GENERAL CATEGORY — if the page contains every word of the
   generalCategoryName, verdict "good".

3. Otherwise verdict "none".

A name is contained when all of its words appear in the page text, in any order
and in any grammatical form, with other words allowed between them.

Matching is literal: a word that appears only in another language, or only as a
synonym, is not a match.

When the retrieved text is missing or cut short, use the title and text you were
given and never assume content you cannot see.

For verdict "good", set reason to null and set evidence to the exact substring of
the page text in which the generalCategoryName occurs. For verdict "none", set
evidence to null and state in reason which rule decided it and, when rule 2
decided it, which word of the name was missing.

Return JSON only with exactly these fields:
{"verdict": "good" | "none", "evidence": <verbatim quote or null>,
 "reason": <short English note for "none", else null>}
`.trim();

// Revert paths:
//   v17 -> v15: swap the two constants below to PAGE_TRIAGE_PROMPT_V15 and
//   'page-triage-v15'. The triage input matches v15 again, so nothing else
//   changes.
//   v17 -> v16: use PAGE_TRIAGE_PROMPT_V16 and 'page-triage-v16', and add
//   productName / categoryName / description in PageCollectionService's
//   buildTriageInput (v16 reads them).
export const PAGE_TRIAGE_PROMPT_VERSION = 'page-triage-v17';

export const PAGE_TRIAGE_PROMPT = PAGE_TRIAGE_PROMPT_V17;
