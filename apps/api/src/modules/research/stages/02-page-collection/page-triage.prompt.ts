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
 *
 * v18 — require evidence that the publisher offers the goods. A seller can
 * make that offer in an article. Keep v17 literal category matching.
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

export const PAGE_TRIAGE_PROMPT_V18 = `
Decide whether one page shows that its publisher sells goods in the category
named by generalCategoryName. Input fields are targetCountry,
generalCategoryName, and page (URL, title and text).

Apply these checks in order.

1. Source. Return "none" for journals, news sites, dictionaries, terminology
   pages, classifieds, directories, price-comparison sites and third-party
   marketplaces. This includes a seller's advert hosted on a third-party
   platform. Also exclude mass-market chains and general-purpose stores
   spanning many unrelated departments, even on a relevant product page.
   On a seller's own site, apply the next checks to any page format, including
   articles, guides and how-to pages.

2. Category. Keep the literal matching rule: every word of generalCategoryName
   must appear in the supplied title or text, in any order or grammatical
   form. Other words may appear between them. A translation or synonym alone
   does not satisfy a missing word. If a word is missing, return "none".

3. Offer. Return "good" only when the publisher offers those goods. A product
   card or catalogue entry identifying the goods as part of the seller's range
   is sufficient. So is a statement that customers can buy or order those goods
   from the publisher or find them in its stores. A price or checkout is optional.
   Apply this same test inside articles and guides.
   Return "none" if the only offer is a service such as installation or repair,
   or the goods appear only as materials used in a completed project, advice,
   or a reference to another seller. A price for labour proves only a service.
   If the business offers both goods and services, its own offer of the goods
   qualifies.

Use only the supplied page. For "good", copy one contiguous verbatim excerpt
from the text or title showing the strongest evidence of the goods on offer.
Use surrounding words when they identify the seller's range or where to buy.
A bare category mention in unrelated prose is insufficient. Set reason to null.
For "none", set evidence to null and give a short English reason naming the
deciding check. For a failed category check, identify the missing word.

Return JSON only with exactly these fields:
{"verdict": "good" | "none", "evidence": <verbatim quote or null>,
 "reason": <short English note for "none", else null>}
`.trim();

export const PAGE_TRIAGE_PROMPT_V19 = `
Decide whether one page shows that its publisher sells goods in the category
named by generalCategoryName. Input fields are targetCountry,
generalCategoryName, and page (URL, title and text).

Apply these checks in order.

1. Source. Return "none" for journals, news sites, dictionaries, terminology
   pages, classifieds, directories, price-comparison sites and third-party
   marketplaces. This includes a seller's advert hosted on a third-party
   platform, and a company profile published in someone else's catalogue or
   directory. An article, guide or buyer's advice published on a site that is
   not itself a seller — a portal, magazine, news site or directory — is a
   third-party publication: return "none", even when it quotes a seller's
   offer. Also exclude mass-market chains and general-purpose stores
   spanning many unrelated departments, even on a relevant product page.
   On a seller's own site, apply the next checks to any page format, including
   articles, guides and how-to pages.

2. Category. Keep the literal matching rule: every word of generalCategoryName
   must appear in the supplied title or text, in any order or grammatical
   form. Other words may appear between them. A translation or synonym alone
   does not satisfy a missing word. If a word is missing, return "none".

3. Offer. Return "good" only when the site's own publisher offers those goods.
   A product card, or a catalogue entry that presents the goods as buyable —
   product name, dimensions, price, or an order/buy action — is sufficient. So
   is a statement that customers can buy or order those goods from the
   publisher or find them in its stores. A price or checkout is optional. Apply
   this same test inside articles and guides on the seller's own site.
   A list or table of department or category names is not an offer, even when
   the category appears in it.
   The offer must belong to the publisher of this page. If the page presents
   someone else's company as the seller — for example a company name shown with
   its address, phone or company code above or below the offer, inside a
   catalogue, directory, marketplace or shop inside another shop — return
   "none", even when that company's offer is quoted in full.
   Return "none" if the only offer is a service such as installation or repair,
   or the goods appear only as materials used in a completed project, advice,
   or a reference to another seller. A price for labour proves only a service.
   If the business offers both goods and services, its own offer of the goods
   qualifies.

Use only the supplied page. For "good", copy one contiguous verbatim excerpt
from the text or title showing that this publisher offers these goods. A
manufacturer's range description, a price-list line, a catalogue item or a
sentence about selling them all qualify; quote the words that name the seller
when they appear nearby. A navigation menu, a category link, an installation
instruction, an unrelated product line or a bare category mention in unrelated
prose is too weak on its own. Set reason to null.
For "none", set evidence to null and give a short English reason naming the
deciding check. For a failed category check, identify the missing word.

Return JSON only with exactly these fields:
{"verdict": "good" | "none", "evidence": <verbatim quote or null>,
 "reason": <short English note for "none", else null>}
`.trim();

// To restore v18, select PAGE_TRIAGE_PROMPT_V18 and 'page-triage-v18' below.
// To restore v17, select PAGE_TRIAGE_PROMPT_V17 and 'page-triage-v17'.
// v16 additionally requires productName, categoryName and description in buildTriageInput.
export const PAGE_TRIAGE_PROMPT_VERSION = 'page-triage-v19';
export const PAGE_TRIAGE_PROMPT = PAGE_TRIAGE_PROMPT_V19;
