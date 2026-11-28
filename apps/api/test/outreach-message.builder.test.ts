import { describe, expect, it } from 'vitest';

import {
  buildOutreachEmail,
  buildOutreachSignatureLines,
} from '../src/modules/outreach-email/outreach-message.builder';
import type {
  OutreachMessageInput,
  OutreachSignature,
} from '../src/modules/outreach-email/outreach-email.types';

const SIGNATURE: OutreachSignature = {
  greeting: 'Best regards,',
  companyName: 'Synthetic Trading',
  phone: '+370 6000 0000',
  website: 'https://example.test',
  whatsapp: 'https://wa.me/37060000000',
  text: 'Monday to Friday',
};

const ATTACHMENT_BYTES = Buffer.from('synthetic attachment content', 'utf8');

function input(overrides: Partial<OutreachMessageInput> = {}): OutreachMessageInput {
  return {
    senderName: 'Ema Seller',
    senderEmail: 'sales@example.test',
    recipient: 'test@example.test',
    subject: 'Supply partnership',
    body: 'Hello,\n\nWe would like to discuss supply.',
    signature: SIGNATURE,
    attachments: [
      {
        filename: 'price-list.pdf',
        contentType: 'application/pdf',
        content: ATTACHMENT_BYTES,
      },
    ],
    ...overrides,
  };
}

function textOrder(text: string): number[] {
  return [
    'Best regards,',
    'Ema Seller',
    'Synthetic Trading',
    'Phone: +370 6000 0000',
    'Website: https://example.test',
    'WhatsApp: https://wa.me/37060000000',
    'Monday to Friday',
  ].map((value) => text.indexOf(value));
}

function htmlOrder(html: string): number[] {
  return [
    'Best regards,',
    'Ema Seller',
    'Synthetic Trading',
    'Phone: ',
    'https://example.test',
    'https://wa.me/37060000000',
    'Monday to Friday',
  ].map((value) => html.indexOf(value));
}

describe('outreach message builder', () => {
  it('uses the account sender name and address, the recipient and the saved subject', () => {
    const message = buildOutreachEmail(input());

    expect(message.from).toEqual({
      name: 'Ema Seller',
      address: 'sales@example.test',
    });
    expect(message.to).toBe('test@example.test');
    expect(message.subject).toBe('Supply partnership');
  });

  it('composes the body and signature in the accepted order as plain text', () => {
    const message = buildOutreachEmail(input());

    expect(message.text).toBe(
      [
        'Hello,',
        '',
        'We would like to discuss supply.',
        '',
        'Best regards,',
        'Ema Seller',
        'Synthetic Trading',
        'Phone: +370 6000 0000',
        'Website: https://example.test',
        'WhatsApp: https://wa.me/37060000000',
        '',
        'Monday to Friday',
      ].join('\n'),
    );

    const positions = textOrder(message.text);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
  });

  it('carries every attachment unchanged', () => {
    const message = buildOutreachEmail(input());

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]?.filename).toBe('price-list.pdf');
    expect(message.attachments[0]?.contentType).toBe('application/pdf');
    expect(Buffer.from(message.attachments[0]?.content ?? []).equals(ATTACHMENT_BYTES)).toBe(
      true,
    );
  });

  it('renders the website and WhatsApp values as clickable anchors in HTML', () => {
    const message = buildOutreachEmail(input());

    expect(message.html).toContain(
      '<a href="https://example.test/">https://example.test</a>',
    );
    expect(message.html).toContain(
      '<a href="https://wa.me/37060000000">https://wa.me/37060000000</a>',
    );

    const positions = htmlOrder(message.html);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
  });

  it('escapes message and signature text instead of rendering markup', () => {
    const message = buildOutreachEmail(
      input({
        subject: '<b>Supply</b>',
        body: '<script>alert(1)</script>\nSecond line',
        signature: { ...SIGNATURE, text: 'A & B <tag>' },
      }),
    );

    expect(message.text).toContain('<script>alert(1)</script>');
    expect(message.html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt;<br />Second line',
    );
    expect(message.html).toContain('A &amp; B &lt;tag&gt;');
    expect(message.html).not.toContain('<script>');
  });

  it('never turns a non-HTTP signature link into an anchor', () => {
    const message = buildOutreachEmail(
      input({
        signature: {
          ...SIGNATURE,
          website: 'javascript:alert(1)',
          whatsapp: 'not a url',
        },
      }),
    );

    expect(message.html).not.toContain('<a href="javascript:');
    expect(message.html).not.toContain('<a href="not a url"');
    expect(message.text).toContain('Website: javascript:alert(1)');
    expect(message.text).toContain('WhatsApp: not a url');
  });

  it('omits the signature block when no signature is configured', () => {
    const message = buildOutreachEmail(
      input({
        signature: {
          greeting: null,
          companyName: null,
          phone: null,
          website: null,
          whatsapp: null,
          text: null,
        },
      }),
    );

    expect(message.text).toBe('Hello,\n\nWe would like to discuss supply.');
    expect(message.html).not.toContain('Best regards,');
    expect(message.html).not.toContain('margin-top:16px');
  });

  it('keeps the sender name out of the signature when it is blank', () => {
    const message = buildOutreachEmail(input({ senderName: '   ' }));

    expect(message.text).toContain('Best regards,\nSynthetic Trading');
    expect(message.text).not.toContain('\n   \n');
  });
});

describe('outreach signature lines', () => {
  it('orders greeting, sender, company, phone, website and WhatsApp', () => {
    expect(buildOutreachSignatureLines(SIGNATURE, 'Ema Seller')).toEqual([
      { key: 'greeting', label: null, value: 'Best regards,', href: null },
      { key: 'sender', label: null, value: 'Ema Seller', href: null },
      { key: 'company', label: null, value: 'Synthetic Trading', href: null },
      { key: 'phone', label: 'Phone', value: '+370 6000 0000', href: null },
      {
        key: 'website',
        label: 'Website',
        value: 'https://example.test',
        href: 'https://example.test/',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        value: 'https://wa.me/37060000000',
        href: 'https://wa.me/37060000000',
      },
    ]);
  });

  it('returns no lines for an entirely unconfigured signature', () => {
    expect(
      buildOutreachSignatureLines(
        {
          greeting: null,
          companyName: null,
          phone: null,
          website: null,
          whatsapp: null,
          text: null,
        },
        'Ema Seller',
      ),
    ).toEqual([]);
  });
});
