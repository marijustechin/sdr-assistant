export const PAGE_ASSESSMENT_PROMPT_VERSION = 'page-assessment-v1';

export const PAGE_ASSESSMENT_PROMPT = `
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
reason must be one short sentence in English. For "b", explain what limits
the match to the category. For "none", give the decisive reason.
For "a" or "b", evidence must be a short verbatim quote from the supplied
title, content or excerpts that best identifies the offered item or category.
Keep the quote in its original language. For "none", set evidence to null.
`.trim();
