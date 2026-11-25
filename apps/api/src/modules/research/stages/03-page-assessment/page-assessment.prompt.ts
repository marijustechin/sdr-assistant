/**
 * Stage 03 page assessment.
 *
 * v1 — one call returns a/b/none plus a reason and a quote. In the first
 * sample it produced self-contradictions (a "b" whose reason said there is no
 * evidence), judged editorial pages inconsistently and left the category
 * boundary to intuition.
 *
 * v2 — one call returns facts only: publisher, offer, category match, one
 * entry per declared product trait, and market. `deriveVerdict()` turns them
 * into a/b/none, so the rule lives in code and a missing trait fails the page
 * instead of shortening the list. The category boundary and the traits come
 * from the study spec, not from the model.
 *
 * v3 — v2 with one rule in question 2: a product type explicitly excluded by
 * spec.category wins over confirmed exact-product traits. This is the
 * colleague's single fix, without the "strongest offer that belongs to the
 * category" sentence from the failed v2.1 attempt — that sentence pulled panel
 * pages toward "yes" instead of excluding them.
 *
 * To restore v2, select PAGE_ASSESSMENT_PROMPT_V2 and 'page-assessment-v2';
 * for v1, PAGE_ASSESSMENT_PROMPT_V1 and 'page-assessment-v1'. Their schemas
 * are still in page-assessment.schema.ts.
 */
export const PAGE_ASSESSMENT_PROMPT_V1 = `
Assess one web page for a seller search in targetCountry.
Decide what the publisher of this page offers for sale.

The input contains targetCountry, targetLanguage, product, and page.
The product has a local productName, categoryName, generalCategoryName,
and an optional English description. The page has a URL, title, content,
and excerpts. Use only the supplied information.

1. Identify the seller and the offer.

Return "none" for third-party marketplaces, classifieds, company directories,
price-comparison sites, general-purpose mass-market retailers, and editorial
pages such as news, guides or blog posts. A seller's advertisement on a
third-party platform is still a third-party listing.

A specialist seller's category page can qualify. Look for actual catalogue
items or a statement that the publisher sells, supplies or makes the relevant
goods to order. A category word in a navigation menu alone is insufficient.
A price, checkout button or online shop is optional.

2. Classify the strongest offer this page supports.

"a" — The publisher offers the exact product. Use productName and the English
description to identify its defining traits. Accept established trade names,
synonyms and grammatical forms in the seller's language. The defining traits
must describe the same offered item. Do not combine a material from one item
with a product type or treatment from another.

"b" — The publisher offers goods within categoryName or generalCategoryName,
but the available evidence supports only the category. Use "b" when a
defining trait of the exact product is missing or explicitly differs, as long
as the offered item still belongs to the category.

"none" — The page does not establish either offer. A related product, a
possible use, a buyer seeking suppliers, or an installation service alone
does not establish that the publisher sells the goods. If the target product
is itself a service, the publisher's offer to perform it counts.

Use the English description to understand the product. A description of its
typical buyer or a suggested use is background unless it defines the product.
A public price is optional for both "a" and "b".

3. Use the available market evidence.

If the page explicitly limits the offer to another market and excludes
targetCountry, return "none". A domain suffix, the page language, or a
foreign address alone does not establish this. When the market is unclear,
classify the visible offer and mention that uncertainty in reason.

Return JSON only, with exactly these fields:
{"verdict":"a","reason":"...","evidence":"..."}

verdict must be "a", "b" or "none".
reason must be one short sentence in English. For "b", explain what limits the
match to the category. For "none", give the decisive reason.
For "a" or "b", evidence must be a short verbatim quote from the supplied
title, content or excerpts that best identifies the offered item or category.
Keep the quote in its original language. For "none", set evidence to null.
`.trim();

export const PAGE_ASSESSMENT_PROMPT_V2 = `
Assess ONE web page for a seller search in targetCountry. Report what the page
shows: the verdict is derived from your answer, so report facts, not a
conclusion.

The input contains:
- targetCountry: the market the search is for;
- targetLanguage: the language of the page's market;
- product: productName, categoryName, generalCategoryName and the English
  description of the product the client wants to find sellers for;
- spec.category: what belongs to the category, and what is outside it;
- spec.traits: the defining traits of the exact product, each with the name to
  use in the answer and what confirms it;
- page: URL, title, content and excerpts. Use only the supplied information.

Answer four questions.

1. Publisher and offer. Who publishes this page, and what does the publisher
   itself offer on it? Quote the words that show the offer.
   - "seller": the publisher's own commercial offer is on this page;
   - "third_party": the offer belongs to someone else — a marketplace,
     classifieds, a directory, a price-comparison site, or another company
     presented inside someone else's catalogue;
   - "mass_market_retailer": a general-purpose chain or store spanning many
     unrelated departments, even on a relevant page;
   - "unclear": the page does not show who sells.
   A category name in a menu, a navigation link or a product-group label is
   not an offer — use evidence_type "label_only". A price or a specification
   alone does not prove that the publisher sells the item. An article, guide
   or news post on the publisher's own site is judged by its content: if it
   names the goods the publisher sells, it can be an offer; a general text
   does not prove one.

2. Item and category. Name the concrete item the publisher offers on this page
   and decide whether it belongs to spec.category. Quote the page.
   - "yes" only with a statement or a catalogue entry for an item that matches
     the category description;
   - "no" for an adjacent product: a different product type, a different
     material class, an accessory, a service or a different use;
   - "unknown" when the page does not reveal what is sold.
   A name in a menu alone cannot make this "yes".

3. Exact product traits. For every trait in spec.traits, report whether the
   offered item confirms it, differs from it, or the page does not reveal it.
   Put the page's own wording in value; a confirmed synonym counts as
   confirmed. Base this on the offered item, not on the category. Return
   exactly one entry per declared trait, using the declared name. "unknown" is
   a valid answer; a missing entry is not.

4. Market. Use "other" only when the page states that the offer does not serve
   targetCountry. A domain suffix, the page language or a foreign address
   alone does not establish this; use "unclear" in that case.

Return JSON only, one object, exactly these fields:
{
  "publisher": "seller | third_party | mass_market_retailer | unclear",
  "offer": {
    "item": "<what the publisher offers here, or null>",
    "quote": "<verbatim evidence or null>",
    "evidence_type": "catalogue | price | sale_statement | spec | label_only | none"
  },
  "category": {
    "match": "yes | no | unknown",
    "quote": "<verbatim evidence or null>"
  },
  "traits": {
    "<declared trait name>": {
      "match": "confirmed | differs | unknown",
      "value": "<the page's wording or null>"
    }
  },
  "market": {
    "status": "target | other | unclear",
    "note": "<short or null>"
  },
  "note": "<one short sentence>"
}

Every quote must be verbatim from the page title, content or excerpts, in its
original language. Do not add fields and do not return prose outside the
object.
`.trim();

export const PAGE_ASSESSMENT_PROMPT_V3 = `
Assess ONE web page for a seller search in targetCountry. Report what the page
shows: the verdict is derived from your answer, so report facts, not a
conclusion.

The input contains:
- targetCountry: the market the search is for;
- targetLanguage: the language of the page's market;
- product: productName, categoryName, generalCategoryName and the English
  description of the product the client wants to find sellers for;
- spec.category: what belongs to the category, and what is outside it;
- spec.traits: the defining traits of the exact product, each with the name to
  use in the answer and what confirms it;
- page: URL, title, content and excerpts. Use only the supplied information.

Answer four questions.

1. Publisher and offer. Who publishes this page, and what does the publisher
   itself offer on it? Quote the words that show the offer.
   - "seller": the publisher's own commercial offer is on this page;
   - "third_party": the offer belongs to someone else — a marketplace,
     classifieds, a directory, a price-comparison site, or another company
     presented inside someone else's catalogue;
   - "mass_market_retailer": a general-purpose chain or store spanning many
     unrelated departments, even on a relevant page;
   - "unclear": the page does not show who sells.
   A category name in a menu, a navigation link or a product-group label is
   not an offer — use evidence_type "label_only". A price or a specification
   alone does not prove that the publisher sells the item. An article, guide
   or news post on the publisher's own site is judged by its content: if it
   names the goods the publisher sells, it can be an offer; a general text
   does not prove one.

2. Item and category. Name the concrete item the publisher offers on this page
   and decide whether it belongs to spec.category. Quote the page.
   Identify the offered item from its title and description. If the item is
   one of the product types explicitly excluded by spec.category, set
   category.match to "no" and quote the wording that identifies it. Apply this
   exclusion even when all exact-product traits are confirmed. Interpret trade
   terms in context; a single word alone does not establish the product type.
   - "yes" only with a statement or a catalogue entry for an item that matches
     the category description;
   - "no" for an adjacent product: a different product type, a different
     material class, an accessory, a service or a different use;
   - "unknown" when the page does not reveal what is sold.
   A name in a menu alone cannot make this "yes".

3. Exact product traits. For every trait in spec.traits, report whether the
   offered item confirms it, differs from it, or the page does not reveal it.
   Put the page's own wording in value; a confirmed synonym counts as
   confirmed. Base this on the offered item, not on the category. Return
   exactly one entry per declared trait, using the declared name. "unknown" is
   a valid answer; a missing entry is not.

4. Market. Use "other" only when the page states that the offer does not serve
   targetCountry. A domain suffix, the page language or a foreign address
   alone does not establish this; use "unclear" in that case.

Return JSON only, one object, exactly these fields:
{
  "publisher": "seller | third_party | mass_market_retailer | unclear",
  "offer": {
    "item": "<what the publisher offers here, or null>",
    "quote": "<verbatim evidence or null>",
    "evidence_type": "catalogue | price | sale_statement | spec | label_only | none"
  },
  "category": {
    "match": "yes | no | unknown",
    "quote": "<verbatim evidence or null>"
  },
  "traits": {
    "<declared trait name>": {
      "match": "confirmed | differs | unknown",
      "value": "<the page's wording or null>"
    }
  },
  "market": {
    "status": "target | other | unclear",
    "note": "<short or null>"
  },
  "note": "<one short sentence>"
}

Every quote must be verbatim from the page title, content or excerpts, in its
original language. Do not add fields and do not return prose outside the
object.
`.trim();

export const STUDY_CRITERIA_PROMPT = `
Define only the traits needed to recognise the exact product for verdict a.

The input carries targetLanguage, targetCountry and product with productName,
categoryName, generalCategoryName and an optional English description. The
category names were identified in stage 01 for this market and are authoritative.
Never create, rename, translate, narrow or replace categoryName or
generalCategoryName. The English description may help identify distinguishing
traits; it must not change the category.

Use productName, categoryName, generalCategoryName and the supplied description
to capture the item type and the defining characteristics of the exact product.
Use local trade synonyms and grammatical forms from targetLanguage where they
distinguish the product. Exclude optional features and incidental seller details.
Give each trait a unique short lowercase identifier; write its expected value
and description in targetLanguage, not English.

Before returning, test the traits against an ordinary variant of the category:
the variant may belong to categoryName or generalCategoryName while differing in
an exact trait. Do not promote a category-level requirement into a trait unless
it distinguishes the exact product. Return no category field.

Return JSON only:
{"language":"<the supplied targetLanguage>","traits":[{"name":"<identifier>","expected":"<required characteristic in targetLanguage>"}]}
`.trim();

export const PAGE_ASSESSMENT_PROMPT_V4 = `
Assess ONE web page for a seller search in targetCountry. Report what the page
shows: the verdict is derived from your answer, so report facts, not a
conclusion.

The input contains:
- targetCountry: the market the search is for;
- targetLanguage: the language of the page's market;
- product.productName: the exact local product name from stage 01;
- product.categoryName: the specific local category from stage 01;
- product.generalCategoryName: the broader local category from stage 01;
- product.description: an optional English description used only to explain the
  exact product's distinguishing traits;
- spec.traits: the defining traits of the exact product, each with the name to
  use in the answer and what confirms it;
- page: URL, title, content and excerpts. Use only the supplied information.

The category names are authoritative. Do not translate, replace or narrow them.
A page whose concrete offer belongs to categoryName or generalCategoryName is in
the category for verdict b. Verdict a additionally requires the exact product
productName and all spec.traits to be confirmed.

Answer five questions about this page.

1. Publisher and offer. Who publishes this page, and what does the publisher
   itself offer on it? Quote the words that show the offer.
   - "seller": the publisher's own commercial offer is on this page;
   - "third_party": the offer belongs to someone else — a marketplace,
     classifieds, a directory, a price-comparison site, or another company
     presented inside someone else's catalogue;
   - "mass_market_retailer": a general-purpose chain or store spanning many
     unrelated departments, even on a relevant page;
   - "unclear": the page does not show who sells.
   A category name in a menu, a navigation link or a product-group label is
   not an offer — use evidence_type "label_only". A price or a specification
   alone does not prove that the publisher sells the item. An article, guide
   or news post on the publisher's own site is judged by its content: if it
   names the goods the publisher sells, it can be an offer; a general text
   does not prove one.

2. Item and category. Name the concrete item the publisher offers on this page
   and decide whether it belongs to product.categoryName or
   product.generalCategoryName. A concrete offer belonging to the broader
   generalCategoryName is enough for category.match "yes"; do not require the
   exact productName here. Quote the page.
   Identify the offered item from its title and description, using the page's
   local synonyms and grammatical forms in targetLanguage. A category name in a
   menu, a navigation link, a product-group label or a third-party mention is
   not an offer.
   - "yes" only with a statement or a catalogue entry for a concrete item that
     belongs to categoryName or generalCategoryName;
   - "no" when the concrete item offered falls outside both product.categoryName
     and product.generalCategoryName. A difference in material, treatment or use
     warrants "no" only if it puts the item outside both categories.
   - "unknown" when the page does not reveal what is sold.
   A name in a menu alone cannot make this "yes".

3. Exact product traits. For every trait in spec.traits, report whether the
   offered item confirms it, differs from it, or the page does not reveal it.
   Put the page's own wording in value; a confirmed synonym counts as
   confirmed. Base this on the offered item, not on the category. Return
   exactly one entry per declared trait, using the declared name. "unknown" is
   a valid answer; a missing entry is not.
   Verdict a requires the seller's own offer to match product.productName and
   every exact trait to be confirmed. Verdict b requires only a concrete offer
   in categoryName or generalCategoryName; exact traits may differ or be
   unknown.

4. Offer language. Set offerLanguage to "target" when the substantive offer
   for the item is written in targetLanguage, including a bilingual offer.
   Set it to "other" when the offer is clearly written only in another
   language. Use "unknown" for a bare brand, model code, price, or too little
   original wording. Use the seller's words in the title, body or excerpts.
   Ignore menus, locale selectors and translated search summaries.

5. Market. Set market.status to "target" when the seller addresses buyers
   in targetCountry with this offer. A local commercial catalogue can
   establish this without delivery terms. For a language shared by several
   countries, look for country-specific commercial context. For an offer in
   another language, require direct evidence of local sale of the relevant
   goods, such as an identified sales outlet in targetCountry.
   Shipping destinations (including EU or worldwide coverage), registration
   details and a domain suffix alone cannot establish local trade.
   Use "other" only for explicit sales exclusion or sales limited elsewhere.
   Otherwise use "unclear". For "target" and "other", put a verbatim
   supporting quote from this page in market.note. For "unclear" use null.

Return JSON only, one object, exactly these fields:
{
  "offerLanguage": "target | other | unknown",
  "publisher": "seller | third_party | mass_market_retailer | unclear",
  "offer": {
    "item": "<what the publisher offers here, or null>",
    "quote": "<verbatim evidence or null>",
    "evidence_type": "catalogue | price | sale_statement | spec | label_only | none"
  },
  "category": {
    "match": "yes | no | unknown",
    "quote": "<verbatim evidence or null>"
  },
  "traits": {
    "<declared trait name>": {
      "match": "confirmed | differs | unknown",
      "value": "<the page's wording or null>"
    }
  },
  "market": {
    "status": "target | other | unclear",
    "note": "<short or null>"
  },
  "note": "<one short sentence>"
}

Every quote must be verbatim from the page title, content or excerpts, in its
original language. Do not add fields and do not return prose outside the
object.
`.trim();

// v5 removes the generated category from stage 03; page assessment uses the
// stage 01 categoryName/generalCategoryName directly.
export const PAGE_ASSESSMENT_PROMPT_VERSION = 'page-assessment-v5';
export const PAGE_ASSESSMENT_PROMPT = PAGE_ASSESSMENT_PROMPT_V4;
