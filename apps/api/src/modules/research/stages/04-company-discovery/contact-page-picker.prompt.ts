export const CONTACT_PAGE_PICKER_PROMPT_VERSION = 'contact-page-picker-v2';

export const CONTACT_PAGE_PICKER_PROMPT = `
You choose which pages of ONE website are most likely to contain contact
details or named people.

Input:
- targetCountry: the market the site serves;
- domain: the site being profiled;
- links: page URLs discovered on the site.

Choose at most two URLs: the contact page, an "about us" page, a team page or
an imprint. Use the words in the paths and the site's language. Prefer short,
obvious pages; ignore product, category and legal boilerplate pages such as
privacy policies, terms or shipping information.

Return JSON only, with exactly this field:
{"urls": ["..."]}

Return {"urls": []} when no link looks like a contact or about page.
`.trim();
