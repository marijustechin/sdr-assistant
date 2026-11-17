export const COMPANY_DISCOVERY_PROMPT_VERSION = 'company-discovery-v9';

export const COMPANY_DISCOVERY_PROMPT = `
You build ONE company profile from data collected for a single website.

Input:
- targetCountry: the single market this research is for;
- product: productName (the exact local product name, already written in that
  market's commercial language), categoryName and generalCategoryName (broader
  local categories);
- domain: the website being profiled;
- pages: pages already kept for this domain, each with URL, title and text;
- homepage: the site's main page as Markdown (may be null);
- extraPages: additional pages fetched on request (may be empty);
- links: URLs discovered on the site (may be empty);
- previous: your earlier answer for this domain (may be null).

Tasks:
1. Company facts: trading name, legal name, company registration number,
   VAT number, address, city, country.
   The registration number and the VAT number are written differently in every
   country (įmonės kodas, IČO, NIP, adószám, CUI, company number, VAT ID, USt-IdNr);
   copy the local label and value as the page prints them.
2. Contacts: emails and people. For every email record the URL of the supplied
   page it came from. A person has a name, and optionally a role (director,
   sales manager, owner) and an email.
3. Verdict based on the supplied information about the company:

   Interpret categoryName and generalCategoryName in the context of productName.
   A shared category word does not make different product or material groups
   equivalent.

   - "a": the supplied information supports an offer of the product itself: the
     identifying material (the species or the material it is made of) and the
     product form both match productName. Word order and grammatical forms may
     differ. Qualifiers that only describe a treatment, grade, colour,
     dimension, brand or style are optional: a product that matches the material
     and the form counts even when such a qualifier is missing. A different
     material or a different product form does not match.
   - "b": the supplied information supports selling products in the relevant
     category, but does not establish the product itself.
     Other variants within that category qualify.
     A matching category word alone is insufficient when the actual offered
     products belong to a different material or product group.
   - "none": the supplied information shows offers outside the relevant
     product/category scope, without evidence supporting "a" or "b".
   - "unclear": the supplied information is insufficient to establish whether
     the company offers the product or relevant category.

   Mentions of another company's products do not establish this company's offer.
   Briefly explain the verdict in notes.

4. Prices, only when the verdict is "a": return every price this company prints
   next to the product name or its identifying words, on any supplied page. Give
   the price exactly as printed, the currency, the unit when the page states one
   (for example m², m, piece), and the URL of the page it came from. A price that
   is not tied to the product name is not an offer of the product, whatever page
   it appears on.
   Do not compute, convert or compare prices. Do not copy cart totals, delivery
   fees, old or crossed-out prices, prices of other products or placeholder
   zeros. Return an empty offers list when no price is shown.

Rules:
- Never invent an email, name, address, person, role or registration number.
- Do not return phone numbers.
- Copy emails and registration numbers exactly as written, without reformatting
  or translating.
- Prefer named people with roles when the supplied text shows them.
- Ignore navigation, cookie notices, unrelated departments and boilerplate.
- When "previous" is supplied, treat it as an earlier extraction, not an
  authoritative source. Keep supported facts and add newly supported
  information. Correct earlier claims when the supplied source text contradicts
  them. If sources contain conflicting registration numbers or other facts, do
  not choose a value merely because of the page language: return null for the
  unresolved field and describe the conflict in notes.
- confidence reflects support for the verdict, not extraction completeness.
  Allowed values: high, medium, low.
- Use only the supplied data. Do not search the web.

Return JSON only, with exactly these fields:
{
  "name": null,
  "legalName": null,
  "companyCode": null,
  "vatCode": null,
  "address": null,
  "city": null,
  "country": null,
  "emails": [],
  "people": [],
  "offers": [{ "price": "", "currency": null, "unit": null, "sourceUrl": "" }],
  "verdict": "unclear",
  "confidence": "low",
  "notes": null
}
`.trim();
