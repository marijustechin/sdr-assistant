/**
 * Stage 04 company profiling, first call.
 *
 * v1 — one call per domain: company identity and public contacts, market
 * evidence per 03 offer id, prices for exact-product (`a`) offers, and one
 * optional next page. The model reports facts and quotes only; the market
 * status, verdicts and traits are computed in code.
 */
export const COMPANY_PROFILING_PROMPT_VERSION = 'company-profiling-v1';

export const COMPANY_PROFILING_PROMPT = `
You build ONE company profile for one website (domain) for a seller search in
targetCountry. Report only what the supplied pages show. The code derives the
market status, so do not return a verdict, a market status or a confidence.

The input contains:
- targetCountry: the market the search is for;
- targetLanguage: the language of that market; use its local product terms,
  price units and contact labels when reading the supplied pages;
- product: productName, categoryName, generalCategoryName and an optional
  English description;
- domain: the seller's domain;
- offers: every offer id from stage 03, with its item, verdict, traits,
  marketFrom03, a short quote and sourceUrl;
- excerpts: the selected page texts, each with an id, URL and title;
- homepage: the domain homepage text and URL;
- links: the supplied contact-page candidates, each with an id, URL, anchor and
  kind ("contact").

Answer these questions.

1. Company identity. Report the company's name, legal name, company code, VAT
   number, address, city and country exactly as printed. Use null when a field
   is not shown. Do not guess or complete a registration number.

2. Public contacts. Report emails and phones that are visibly published on the
   supplied pages. Every contact needs the sourceUrl of the page that shows it.
   - An email is public only when it is printed on the page. Use label "sales"
     for a sales address, "general" for a general address, or null.
   - A phone is a contact only when the page labels it as one (for example
     "tel.", "telefonas", "skambinkite", "kontaktai"). Do not report a random
     number from the page text.
   - contactFormUrl: only when the supplied page text or a supplied link
     anchor shows a form ("forma", "form", "inquiry"). A link to a contact
     page alone is not a form; use it as nextPage. Never invent a URL.

3. Market evidence for every supplied offer id. Quote the seller's own words
   about local pickup, a local shop/catalogue, or the purchase as a whole:
   - channel: "pickup" or "purchase". "purchase" is a statement about the whole
     offer ("sold only in Poland"), not a third delivery method. A delivery
     quote may be reported with channel "delivery", but delivery alone never
     establishes a target market; it is context only.
   - direction: "allows" or "restricts" for targetCountry.
   - scope: "offer" when the quote is about that one offer, "domain" when it is
     the seller's general rule.
   - appliesTo: every supplied offer id the rule covers. For scope "offer",
     list only the offer id of the block you are answering; for scope "domain",
     list every supplied offer id the general rule covers. A delivery
     restriction alone is not a purchase restriction; report what the page
     says.
   - quote: the exact words, copied from the supplied text of sourceUrl.
   - sourceUrl: the supplied URL where that quote appears.
   A statement about the product must control the offer; a general delivery
   promise does not override an explicit product exclusion. If a page says
   nothing about the market, return an empty marketEvidence array for the offer.

4. Prices only for offers whose supplied verdict is "a". For every price:
   - amount: number, the printed price;
   - currency: ISO code (for example "EUR") or null when it is not shown;
   - unit: "m2", "m", "pc", "pack" or null;
   - vatIncluded: true, false or null;
   - priceType: "exact" or "from";
   - variant: the printed variant/grade or null;
   - quote: the exact words of the price, from the text of sourceUrl;
   - sourceUrl: the supplied URL where that price appears.
   The number must be part of a printed price expression (currency or unit next
   to it). In a catalogue, take the price from this offer's own entry — from its
   product heading to the next product heading — and match this offer's item and
   variant. Never attach a price from another product, a delivery fee, a cart
   total or a crossed-out price. A "b" offer gets no prices.

5. Next page. Choose at most one contact link id from the supplied links, or
   null. Use it only when that page is likely to carry missing company contacts.
   Do not invent a URL. Do not choose a delivery page.

Hard rules:
- Use only the supplied text. Never search the web, never invent a field.
- Every quote must be verbatim from the supplied text of the URL named in its
  sourceUrl. The same words on a different page do not count.
- Do not return verdicts, traits, market statuses or confidence scores.
- Set "nextPage" to null when no supplied link is useful.
- Return JSON only, exactly one object with the fields below. No prose outside
  the object.

{
  "company": {
    "name": "<or null>",
    "legalName": "<or null>",
    "code": "<or null>",
    "vat": "<or null>",
    "address": "<or null>",
    "city": "<or null>",
    "country": "<or null>",
    "emails": [
      { "value": "<email>", "label": "sales | general | null", "sourceUrl": "<supplied URL>" }
    ],
    "phones": [
      { "value": "<as printed>", "label": "sales | general | null", "sourceUrl": "<supplied URL>" }
    ],
    "contactFormUrl": "<supplied link URL or null>"
  },
  "offers": [
    {
      "id": "<supplied offer id>",
      "marketEvidence": [
        {
          "channel": "delivery | pickup | purchase",
          "direction": "allows | restricts",
          "scope": "domain | offer",
          "appliesTo": ["<supplied offer id>"],
          "quote": "<verbatim>",
          "sourceUrl": "<supplied URL>"
        }
      ],
      "prices": [
        {
          "amount": 0,
          "currency": "<ISO code or null>",
          "unit": "m2 | m | pc | pack | null",
          "vatIncluded": true,
          "priceType": "exact | from",
          "variant": "<or null>",
          "quote": "<verbatim>",
          "sourceUrl": "<supplied URL>"
        }
      ]
    }
  ],
  "nextPage": { "id": "<supplied link id>", "kind": "delivery | contact" },
  "notes": "<one short sentence or null>"
}
`.trim();

/**
 * Second call: merge two newly fetched pages into the previous answer.
 *
 * The merge is also enforced in code: a missing price or contact in this answer
 * never deletes what the first call already proved.
 */
export const COMPANY_PROFILING_FOLLOWUP_PROMPT = `${COMPANY_PROFILING_PROMPT}

SECOND CALL for the same domain.
The input additionally contains:
- previous: your exact previous answer for this domain;
- newPages: newly fetched pages, each with url, title, kind and text.

Merge the new pages into previous and return the complete merged answer in the
same schema:
- keep every offer id and every price and contact already in previous, even
  when the new pages do not repeat them;
- add a market rule or contact only when the new page text supports it, with a
  verbatim quote and that page's URL;
- if a new page contradicts an old claim, prefer the newer, more specific quote
  and mention it in notes;
- do not re-extract facts from the old pages and do not invent values.
`.trim();
