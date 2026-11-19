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
 * To restore v1, select PAGE_ASSESSMENT_PROMPT_V1 and 'page-assessment-v1'
 * below; the v1 schema is still in page-assessment.schema.ts.
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

export const PAGE_ASSESSMENT_PROMPT_VERSION = 'page-assessment-v2';
export const PAGE_ASSESSMENT_PROMPT = PAGE_ASSESSMENT_PROMPT_V2;
