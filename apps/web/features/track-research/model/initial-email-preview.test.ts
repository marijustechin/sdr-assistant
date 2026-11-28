import { describe, expect, it } from 'vitest';

import type { EmailAccountSignature } from '@/entities/email-account/client';
import type {
  AttachmentLimits,
  ResearchAttachment,
} from '@/entities/research/client';

import {
  attachmentTotalBytes,
  checkAttachmentSelection,
  formatAttachmentSize,
  signatureLines,
} from './initial-email-preview';

const SIGNATURE: EmailAccountSignature = {
  name: 'Best regards,',
  companyName: 'Synthetic Trading',
  phone: '+370 6000 0000',
  website: 'https://example.test',
  whatsapp: 'https://wa.me/37060000000',
  text: 'Monday to Friday',
};

const SENDER_NAME = 'Ema Seller';

const LIMITS: AttachmentLimits = {
  maxFileBytes: 1024,
  maxAttachments: 2,
  maxTotalBytes: 1500,
};

function attachment(
  overrides: Partial<ResearchAttachment> = {},
): ResearchAttachment {
  return {
    id: 'attachment-1',
    filename: 'price-list.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 512,
    sha256: 'a'.repeat(64),
    createdAt: '2026-11-27T10:00:00.000Z',
    ...overrides,
  };
}

describe('signatureLines', () => {
  it('renders the closing greeting, sender name and remaining fields in order', () => {
    expect(signatureLines(SIGNATURE, SENDER_NAME)).toEqual([
      { key: 'greeting', label: null, value: 'Best regards,', href: null },
      { key: 'sender', label: null, value: 'Ema Seller', href: null },
      {
        key: 'company',
        label: null,
        value: 'Synthetic Trading',
        href: null,
      },
      {
        key: 'phone',
        label: 'Phone',
        value: '+370 6000 0000',
        href: null,
      },
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

  it('omits the closing greeting and sender name when they are unset', () => {
    expect(
      signatureLines({ ...SIGNATURE, name: null }, null).map(
        (line) => line.key,
      ),
    ).toEqual(['company', 'phone', 'website', 'whatsapp']);

    expect(
      signatureLines({ ...SIGNATURE, name: null }, '   ').map(
        (line) => line.key,
      ),
    ).toEqual(['company', 'phone', 'website', 'whatsapp']);
  });

  it('renders nothing for an unconfigured signature, even with a sender name', () => {
    expect(
      signatureLines(
        {
          name: null,
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

  it('never turns a non-HTTP value into a link', () => {
    const lines = signatureLines(
      {
        ...SIGNATURE,
        website: 'javascript:alert(1)',
        whatsapp: 'not a url',
      },
      SENDER_NAME,
    );

    expect(lines.find((line) => line.key === 'website')?.href).toBeNull();
    expect(lines.find((line) => line.key === 'whatsapp')?.href).toBeNull();
  });

  it('handles a missing signature', () => {
    expect(signatureLines(null, SENDER_NAME)).toEqual([]);
  });
});

describe('formatAttachmentSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatAttachmentSize(0)).toBe('0 B');
    expect(formatAttachmentSize(512)).toBe('512 B');
    expect(formatAttachmentSize(2048)).toBe('2.0 KB');
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('checkAttachmentSelection', () => {
  it('accepts a file within every limit', () => {
    expect(checkAttachmentSelection([], LIMITS, 512)).toEqual({ ok: true });
    expect(checkAttachmentSelection([attachment()], LIMITS, 512)).toEqual({
      ok: true,
    });
  });

  it('rejects an empty file', () => {
    expect(checkAttachmentSelection([], LIMITS, 0)).toEqual({
      ok: false,
      message: 'The selected file is empty.',
    });
  });

  it('rejects a file above the per-file limit', () => {
    expect(checkAttachmentSelection([], LIMITS, 1025)).toEqual({
      ok: false,
      message: 'Each attachment must be at most 1.0 KB.',
    });
  });

  it('rejects more than the configured number of attachments', () => {
    expect(
      checkAttachmentSelection(
        [attachment({ id: 'a' }), attachment({ id: 'b' })],
        LIMITS,
        1,
      ),
    ).toEqual({
      ok: false,
      message: 'A research can have at most 2 attachments.',
    });
  });

  it('rejects a file that would exceed the total limit', () => {
    expect(
      checkAttachmentSelection([attachment({ sizeBytes: 1000 })], LIMITS, 600),
    ).toEqual({
      ok: false,
      message: 'The attachments of one research must total at most 1.5 KB.',
    });
  });
});

describe('attachmentTotalBytes', () => {
  it('sums the stored metadata sizes', () => {
    expect(
      attachmentTotalBytes([
        attachment({ id: 'a', sizeBytes: 100 }),
        attachment({ id: 'b', sizeBytes: 250 }),
      ]),
    ).toBe(350);
    expect(attachmentTotalBytes([])).toBe(0);
  });
});
