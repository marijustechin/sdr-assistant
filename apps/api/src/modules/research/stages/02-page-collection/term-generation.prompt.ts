/**
 * Additional query generation for stage 02.
 *
 * v1 — two flat arrays and no view of the run's description, so the model
 * could only reshuffle the three supplied names. Both recorded samples spent
 * half of the four slots on queries with no new word, and one invented an
 * inflection that does not occur in the collected pages.
 *
 * v2 — takes productDescription, asks for a tagged `queries` array (kind,
 * family, why), and states the replacement rule mechanically: a query must add
 * a word the supplied names do not contain. Both recorded samples passed that
 * rule 7/8 times, but the first slot stayed a merge of a supplied product name
 * with a supplied category name, and the channel slot returned directories.
 *
 * v3 — five slots, three per kind. The novelty rule names both arrays and
 * forbids combining, joining, splitting, reordering and inflection. The family
 * is derived from the new word (form words are supply_form, not trade_alias),
 * a channel word needs support in the input, and an application that only the
 * description names wins over a supplied one.
 *
 * v4 — passes sourceWithCategory: pages already found in this market whose
 * title or text contains the broadest category name. The market's wording
 * (form, alias, application, channel) is read from those pages instead of
 * being translated from the English description; productDescription still
 * decides which ideas are true of the product. Everything else is v3.
 *
 * To restore v3, select TERM_GENERATION_PROMPT_V3 and 'term-generation-v3';
 * for v2, TERM_GENERATION_PROMPT_V2 and 'term-generation-v2'; for v1,
 * TERM_GENERATION_PROMPT_V1 and 'term-generation-v1'. The input object in
 * page-collection.service.ts fits every version, though v4 expects the extra
 * `sourceWithCategory` field.
 */
export const TERM_GENERATION_PROMPT_V1 = `
Generate additional web search queries to find sellers in the target market.
The search will already use all supplied productNames and categoryNames.

The input contains:
- productNames: local names for the exact product;
- categoryNames: local seller categories, from specific to broad;
- notes: findings from product identification, possibly empty;
- targetLanguage: the language of the queries;
- targetCountry: the market, if supplied.

Return at most four additional queries TOTAL across the two arrays:
- productNames: phrases likely to find businesses already selling the exact
  product. Preserve its distinguishing characteristics. A local trade name
  can express several of those characteristics in fewer words.
- categoryNames: phrases likely to find businesses already selling goods in
  the same category. Use natural catalogue wording. A useful qualifier can
  narrow a broad category to a relevant product family.

Look in notes for alternative names sellers use. Keep enough context to make
an ambiguous trade term searchable on its own. Write short queries in
targetLanguage, allowing established borrowed trade terms used in that market.

Put a query in productNames only if it preserves the traits that distinguish
the exact product. If it drops one of those traits but still describes goods
in the target category, put it in categoryNames. Either array may be empty.

Each query should reach a seller who may describe the goods differently from
the supplied names. Skip duplicates, reordered words, spelling-only variants
and mechanical singular/plural variants. Avoid generic buying keywords unless
they distinguish a relevant sales channel, such as wholesale for bulk goods.
Exclude queries for installers, end users, possible buyers, related services
and unrelated goods. Only use material, application or grade qualifiers
supported by the input.

Favor useful alternatives for both groups when available. Either array may be
empty. Return fewer than four when additional phrases would repeat a search.
Return only a JSON object with exactly two arrays of strings:
{"productNames": [], "categoryNames": []}
`.trim();

export const TERM_GENERATION_PROMPT_V2 = `
Generate additional web search queries for the target market. The search will
already use every supplied productName and categoryName, so a query earns its
place only by adding something those searches do not cover.

The input contains:
- productDescription: the product description in English, possibly empty. It
  is the most reliable statement of material, treatment, application and
  supply form; use it to decide which qualifiers are true of this product;
- productNames: local names for the exact product;
- categoryNames: local seller categories, from specific to broad; the last one
  is the broadest;
- notes: findings from product identification, possibly empty; it may quote
  names that sellers use;
- targetLanguage: the language of every query;
- targetCountry: the market.

Return one JSON object with one array of at most four items:
{"queries": [{"query": "<query>", "kind": "product|category",
  "family": "application|material|treatment|supply_form|trade_alias|channel",
  "why": "<up to 12 words>"}]}

Each item has exactly these four fields:
- query: a short search query in targetLanguage;
- kind: "product" when the results should offer this exact product, "category"
  when they should offer the wider product family, with any of the product's
  distinguishing traits possibly absent. At most two queries per kind;
- family: exactly one of the values below. At most one query per family:
  application — where the product is used;
  material — what it is made of;
  treatment — how the material is processed;
  supply_form — the form the goods are sold in: board, panel, profile, bale,
    bag, roll, pack;
  trade_alias — another name sellers use for the product or its category;
  channel — wholesale, distributor, importer, manufacturer;
- why: at most 12 words in English naming the word or idea the query adds.

Every query must add at least one word that sellers use and that does not
occur in a supplied name. A different grammatical form, a joined or a split
spelling, a plural, a reordered name is the same words, not a new word. Drop a
weak query instead of filling the four slots.

Take qualifiers from productDescription and names from notes. Prefer a word
quoted in the input over one you invent: do not coin compounds, inflections or
translations that the input does not support.

Keep the broadest category name in at least one query. A page that never uses
it is hard to match to the same category later.

Write queries as a person types them into a search engine: short, natural, no
quotation marks, no operators, no site: filters. Do not add the country or a
city unless the input shows sellers write it that way.

Target businesses that sell, make, distribute or import the goods. Exclude
installers, end users, possible buyers, related services and unrelated goods.
If the product itself is a service, the businesses that perform it are the
target and its own wording is allowed.

Avoid generic buying keywords unless they name a real sales channel, such as
wholesale for bulk goods.

Order the queries by likely usefulness. Return {"queries": []} when no query
passes the test above, and return only that JSON object.
`.trim();

export const TERM_GENERATION_PROMPT_V3 = `
Generate additional web search queries for the target market. The search will
already use every supplied productName and categoryName, so a query earns its
place only by adding something those searches do not cover.

The input contains:
- productDescription: the product description in English, possibly empty. It
  is the most reliable statement of material, treatment, application and
  supply form; use it to decide which qualifiers are true of this product;
- productNames: local names for the exact product;
- categoryNames: local seller categories, from specific to broad; the last one
  is the broadest;
- notes: findings from product identification, possibly empty; it may quote
  names that sellers use;
- targetLanguage: the language of every query;
- targetCountry: the market.

Return one JSON object with one array of at most five items:
{"queries": [{"query": "<query>", "kind": "product|category",
  "family": "application|material|treatment|supply_form|trade_alias|channel",
  "why": "<up to 12 words>"}]}

Each item has exactly these four fields:
- query: a short search query in targetLanguage;
- kind: "product" when the results should offer this exact product, "category"
  when they should offer the wider product family, with any of the product's
  distinguishing traits possibly absent. At most three queries per kind;
- family: exactly one of the values below. At most one query per family:
  application — where the product is used;
  material — what it is made of;
  treatment — how the material is processed;
  supply_form — the form the goods are sold in: board, panel, profile, bale,
    bag, roll, pack;
  trade_alias — another name sellers use for the product or its category;
  channel — wholesale, distributor, importer, manufacturer;
- why: at most 12 words in English naming the new word the query adds.

Every query must add at least one word that sellers use and that occurs in
neither productNames nor categoryNames. A query that only combines, splits,
joins, reorders or inflects supplied names adds nothing: drop it instead of
filling the five slots.

Name the family after the new word the query adds. A word for the form of the
goods — board, panel, profile, bale, bag, roll — is supply_form even inside a
longer seller phrase.

Take qualifiers from productDescription and names from notes. Prefer a word
quoted in the input over one you invent: do not coin compounds, inflections or
translations that the input does not support.

When productDescription names an application that no supplied name contains,
prefer it over repeating an application word that is already supplied.

Keep the broadest category name in at least one query. A page that never uses
it is hard to match to the same category later.

Write queries as a person types them into a search engine: short, natural, in
the form a seller would use in a product heading, no quotation marks, no
operators, no site: filters. Do not add the country or a city unless the input
shows sellers write it that way.

Target businesses that sell, make, distribute or import the goods. Exclude
installers, end users, possible buyers, related services and unrelated goods.
If the product itself is a service, the businesses that perform it are the
target and its own wording is allowed.

Avoid generic buying keywords. Use a channel word only when productDescription
or notes shows that this market sells the product that way; an unsupported one
returns directories and classifieds, not sellers.

Order the queries by likely usefulness. Return {"queries": []} when no query
passes the test above, and return only that JSON object.
`.trim();

export const TERM_GENERATION_PROMPT_V4 = `
Generate additional web search queries for the target market. The search will
already use every supplied productName and categoryName, so a query earns its
place only by adding something those searches do not cover.

The input contains:
- productDescription: the product description in English, possibly empty. It
  is the most reliable statement of material, treatment, application and
  supply form; use it to decide which qualifiers are true of this product;
- productNames: local names for the exact product;
- categoryNames: local seller categories, from specific to broad; the last one
  is the broadest;
- notes: findings from product identification, possibly empty; it may quote
  names that sellers use;
- sourceWithCategory: pages already found in this market whose title or text
  contains the broadest category name; each item has a domain, a title and a
  text excerpt. The list may be empty;
- targetLanguage: the language of every query;
- targetCountry: the market.

Return one JSON object with one array of at most five items:
{"queries": [{"query": "<query>", "kind": "product|category",
  "family": "application|material|treatment|supply_form|trade_alias|channel",
  "why": "<up to 12 words>"}]}

Each item has exactly these four fields:
- query: a short search query in targetLanguage;
- kind: "product" when the results should offer this exact product, "category"
  when they should offer the wider product family, with any of the product's
  distinguishing traits possibly absent. At most three queries per kind;
- family: exactly one of the values below. At most one query per family:
  application — where the product is used;
  material — what it is made of;
  treatment — how the material is processed;
  supply_form — the form the goods are sold in: board, panel, profile, bale,
    bag, roll, pack;
  trade_alias — another name sellers use for the product or its category;
  channel — wholesale, distributor, importer, manufacturer;
- why: at most 12 words in English naming the new word and where it came from:
  pages, notes or description.

Every query must add at least one word that sellers use and that occurs in
neither productNames nor categoryNames. A query that only combines, splits,
joins, reorders or inflects supplied names adds nothing: drop it instead of
filling the five slots.

productDescription decides whether an idea is true of this product;
sourceWithCategory decides how this market words it. Take a qualifier, an
alternative name, an application or a channel word from those pages when it
occurs there, and prefer it over a literal translation of an English
description phrase. The list is a sample: a word missing from it is not proof,
but a word it shows is better evidence than one you invent.

Name the family after the new word the query adds. A word for the form of the
goods — board, panel, profile, bale, bag, roll — is supply_form even inside a
longer seller phrase.

Take qualifiers from productDescription and sourceWithCategory, and names from
notes and sourceWithCategory. Do not coin compounds, inflections or
translations that the input does not support.

When productDescription or sourceWithCategory names an application that no
supplied name contains, prefer it over repeating an application word that is
already supplied.

Keep the broadest category name in at least one query. A page that never uses
it is hard to match to the same category later.

Write queries as a person types them into a search engine: short, natural, in
the form the sellers in sourceWithCategory use, not as a string of keywords.
No quotation marks, no operators, no site: filters. Do not add the country or
a city unless the input shows sellers write it that way.

Ignore prices, dimensions, product codes and brand names on those pages; take
only the words that name the goods, their material, treatment, form or use.

Target businesses that sell, make, distribute or import the goods. Exclude
installers, end users, possible buyers, related services and unrelated goods.
If the product itself is a service, the businesses that perform it are the
target and its own wording is allowed.

Avoid generic buying keywords. Use a channel word only when productDescription,
notes or sourceWithCategory shows that this market sells the product that way;
an unsupported one returns directories and classifieds, not sellers.

Order the queries by likely usefulness. Return {"queries": []} when no query
passes the test above, and return only that JSON object.
`.trim();

export const TERM_GENERATION_PROMPT_VERSION = 'term-generation-v4';
export const TERM_GENERATION_PROMPT = TERM_GENERATION_PROMPT_V4;
