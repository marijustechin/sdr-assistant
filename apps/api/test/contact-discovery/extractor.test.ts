import { readFileSync } from 'node:fs';
import { delimiter } from 'node:path';
import { describe, expect, it } from 'vitest';

import { extractContactCandidates } from '../../src/modules/contact-discovery/contact-discovery.extractor.js';

const SOURCE = 'https://example.test/contact';

function encodeCfEmail(value: string, key = 0x5a): string {
  return [key, ...[...value].map((character) => character.charCodeAt(0) ^ key)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const savedHtmlPaths = (process.env.SDR007A_CLOUDFLARE_HTML ?? '')
  .split(delimiter)
  .filter((value) => value.length > 0);


function phoneValues(html: string): string[] {
  return extractContactCandidates({ html, sourceUrl: SOURCE }).candidates
    .filter((candidate) => candidate.kind === 'phone')
    .map((candidate) => candidate.normalized ?? candidate.value);
}

describe('05.1 contact discovery extractor', () => {
  it('extracts company JSON-LD email, telephone, PostalAddress and registration identity', () => {
    const html = `
      <html><body>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Store",
            "name": "Example Store",
            "email": "sales@example.test",
            "telephone": "+48123456789",
            "vatID": "PL1234567890",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Example Street 7",
              "postalCode": "00-001",
              "addressLocality": "Warsaw",
              "addressCountry": "PL"
            }
          }
        </script>
      </body></html>
    `;
    const result = extractContactCandidates({ html, sourceUrl: SOURCE });

    expect(result.companyNames).toEqual(['Example Store']);
    expect(
      result.candidates.find((candidate) => candidate.kind === 'email'),
    ).toMatchObject({
      value: 'sales@example.test',
      method: 'json_ld',
      companyName: 'Example Store',
      evidence: {
        jsonPath: '$.email',
        quote: '"sales@example.test"',
        sourceUrl: SOURCE,
      },
    });
    expect(
      result.candidates.find((candidate) => candidate.kind === 'phone'),
    ).toMatchObject({
      normalized: '+48123456789',
      method: 'json_ld',
      evidence: { jsonPath: '$.telephone' },
    });
    expect(
      result.candidates.find((candidate) => candidate.kind === 'postal_address'),
    ).toMatchObject({
      value: 'Example Street 7, 00-001 Warsaw, PL',
      structured: {
        streetAddress: 'Example Street 7',
        postalCode: '00-001',
        addressLocality: 'Warsaw',
        addressCountry: 'PL',
      },
      evidence: { jsonPath: '$.address' },
    });
    expect(
      result.candidates.find(
        (candidate) => candidate.kind === 'registration_identifier',
      ),
    ).toMatchObject({
      value: 'PL1234567890',
      identifierKind: 'vatID',
      evidence: { jsonPath: '$.vatID' },
    });
  });

  it('ignores SVG/CSS/JS/attributes/query-string fragments and keeps real tel/mailto/visible contacts', () => {
    const html = `
      <html><head>
        <style>.noise { content: "005 112 54.7148 112"; }</style>
        <script>
          const noResultFound = \`<div><svg width="113" height="112"><path d="M54.7148 112C84.5491 112 108.715 4 54.7148 112Z" /></svg></div>\`;
          const noise = "007 16.2573 0041 65.0097 007 4.74272";
        </script>
        <script src="https://cdn.example.test/app.js?r=20261008070741"></script>
      </head><body>
        <img data-phone="+48999999999" alt="008070741" />
        <a href="https://example.test/?phone=+48777777777">unrelated link</a>
        <a href="mailto:info@example.test?subject=Hello">Email us</a>
        <a href="tel:+48111222333">Telephone</a>
        <p>Contact email hello@example.test. Phone +48 444 555 666.</p>
      </body></html>
    `;
    const result = extractContactCandidates({ html, sourceUrl: SOURCE });
    const phones = result.candidates
      .filter((candidate) => candidate.kind === 'phone')
      .map((candidate) => candidate.normalized);

    expect(phones).toContain('+48111222333');
    expect(phones).toContain('+48444555666');
    expect(phones.some((phone) => phone?.includes('5112547148112'))).toBe(false);
    expect(phones.some((phone) => phone?.includes('41650097'))).toBe(false);
    expect(phones.some((phone) => phone?.includes('7474272'))).toBe(false);
    expect(phones.some((phone) => phone?.includes('7162573'))).toBe(false);
    expect(phones.some((phone) => phone?.includes('8070741'))).toBe(false);

    expect(
      result.candidates.find(
        (candidate) => candidate.method === 'mailto' && candidate.kind === 'email',
      ),
    ).toMatchObject({
      value: 'info@example.test',
      evidence: { attribute: 'href', tag: 'a', quote: 'mailto:info@example.test?subject=Hello' },
    });
    expect(
      result.candidates.find(
        (candidate) => candidate.method === 'visible_text' && candidate.kind === 'email',
      ),
    ).toMatchObject({
      value: 'hello@example.test',
      evidence: {
        offsetScope: 'visible_text',
        context: expect.stringContaining('Contact email'),
      },
    });
  });

  it('does not extract visible contacts without explicit supporting context', () => {
    const result = extractContactCandidates({
      html: `
        <p>info@example.test</p>
        <p>+48 444 555 666</p>
      `,
      sourceUrl: SOURCE,
    });
    expect(result.candidates).toEqual([]);
  });

  it('extracts a visible phone only when a contact label is nearby', () => {
    const result = extractContactCandidates({
      html: '<p>Call us: +48 444 555 666</p>',
      sourceUrl: SOURCE,
    });
    expect(
      result.candidates.find((candidate) => candidate.kind === 'phone'),
    ).toMatchObject({
      method: 'visible_text',
      normalized: '+48444555666',
      evidence: {
        quote: '+48 444 555 666',
        context: expect.stringContaining('Call us'),
      },
    });
  });

  it('ignores contact-like fields on non-company JSON-LD nodes', () => {
    const result = extractContactCandidates({
      html: `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Example Site",
            "email": "unrelated@example.test",
            "telephone": "+48123456789"
          }
        </script>
      `,
      sourceUrl: SOURCE,
    });
    expect(result.candidates).toEqual([]);
  });

  it('normalizes mailto and tel values without running raw-HTML phone regexes', () => {
    const html = `
      <a href="mailto:One@Example.Test">Email</a>
      <a href="tel:+48 (444) 555-666">Call</a>
      <div data-phone="+48111222333"></div>
    `;
    const result = extractContactCandidates({ html, sourceUrl: SOURCE });
    expect(result.candidates.map((candidate) => candidate.normalized)).toEqual(
      expect.arrayContaining(['one@example.test', '+48444555666']),
    );
    expect(
      result.candidates.some((candidate) =>
        candidate.value.includes('+48111222333'),
      ),
    ).toBe(false);
  });

  it('rejects non-HTTP source URLs with an explicit error', () => {
    expect(() =>
      extractContactCandidates({
        html: '<p>email</p>',
        sourceUrl: 'ftp://example.test/page',
      }),
    ).toThrowError(/HTTP/);
  });

  it('does not mistake the phone-shaped fragments used in the pilot for contacts', () => {
    const html = `
      <script>
        const values = ["005 112 54.7148 112", "0041 65.0097",
          "007 4.74272", "007 16.2573", "008070741"];
      </script>
      <a href="https://example.test/?v=20261008070741">version</a>
    `;
    expect(phoneValues(html)).toEqual([]);
  });

  it('decodes Cloudflare email-protection anchors and preserves evidence', () => {
    const encoded = encodeCfEmail('hello@example.test');
    const result = extractContactCandidates({
      html: `<p>Contact email: <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="${encoded}">[email protected]</a></p>`,
      sourceUrl: SOURCE,
    });
    expect(result.candidates.find((candidate) => candidate.kind === 'email')).toMatchObject({
      value: 'hello@example.test',
      method: 'cf_email',
      sourceUrl: SOURCE,
      evidence: {
        method: 'cf_email',
        sourceUrl: SOURCE,
        attribute: 'data-cfemail',
        tag: 'a',
      },
    });
  });

  it('ignores malformed Cloudflare email-protection values', () => {
    const result = extractContactCandidates({
      html: `
        <a href="/cdn-cgi/l/email-protection" data-cfemail="abc">[email protected]</a>
        <a href="/cdn-cgi/l/email-protection" data-cfemail="zzzz">[email protected]</a>
        <a href="/cdn-cgi/l/email-protection" data-cfemail="">[email protected]</a>
        <a href="/cdn-cgi/l/email-protection" data-cfemail="0001">[email protected]</a>
        <a href="/cdn-cgi/l/email-protection" data-cfemail="5a5b5c">[email protected]</a>
      `,
      sourceUrl: SOURCE,
    });
    expect(
      result.candidates.filter((candidate) => candidate.method === 'cf_email'),
    ).toEqual([]);
  });

  (savedHtmlPaths.length > 0 ? it : it.skip)(
    'decodes the valid Cloudflare emails in each saved contact-page artifact',
    () => {
      for (const path of savedHtmlPaths) {
        const html = readFileSync(path, 'utf8');
        const candidates = extractContactCandidates({
          html,
          sourceUrl: 'https://saved.example.test/contact',
        }).candidates.filter(
          (candidate) =>
            candidate.kind === 'email' && candidate.method === 'cf_email',
        );
        expect(new Set(candidates.map((candidate) => candidate.value)).size).toBe(2);
        for (const candidate of candidates) {
          expect(candidate.evidence.sourceUrl).toBe(
            'https://saved.example.test/contact',
          );
          expect(candidate.evidence.method).toBe('cf_email');
        }
      }
    },
  );});
