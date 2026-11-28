import { Injectable } from '@nestjs/common';

import type {
  ComposedOutreachEmail,
  OutreachMessageInput,
  OutreachSignature,
} from './outreach-email.types.js';

/**
 * Pure message construction shared by test sending and the future first-contact
 * sender (SDR-012).
 *
 * The message is composed from the owner-authored subject and plain-text body,
 * the account's closing greeting, the account's existing sender name, the
 * remaining signature fields and the research attachments. The display order is
 * the accepted one:
 *
 *   closing greeting -> sender name -> company -> telephone -> website ->
 *   WhatsApp -> additional signature text
 *
 * A plain-text part is always produced. A minimal HTML part is produced too, so
 * the website and WhatsApp links are real anchors in mail clients that render
 * HTML; every value is escaped and only validated HTTP(S) URLs become links.
 * The owner never authors HTML.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function renderHtmlText(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br />');
}

/** Validates a stored link; anything that is not HTTP(S) stays plain text. */
function safeHttpUrl(value: string | null): string | null {
  if (value === null) return null;

  try {
    const url = new URL(value.trim());

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export type OutreachSignatureLine = {
  readonly key:
    | 'greeting'
    | 'sender'
    | 'company'
    | 'phone'
    | 'website'
    | 'whatsapp';
  readonly label: string | null;
  readonly value: string;
  readonly href: string | null;
};

function hasSignatureContent(signature: OutreachSignature): boolean {
  return (
    signature.greeting !== null ||
    signature.companyName !== null ||
    signature.phone !== null ||
    signature.website !== null ||
    signature.whatsapp !== null ||
    signature.text !== null
  );
}

/**
 * Builds the signature lines in the accepted order. This mirrors the web
 * preview; the sent message is composed by this backend builder, which is the
 * authoritative representation.
 */
export function buildOutreachSignatureLines(
  signature: OutreachSignature,
  senderName: string,
): OutreachSignatureLine[] {
  if (!hasSignatureContent(signature)) {
    return [];
  }

  const lines: OutreachSignatureLine[] = [];

  if (signature.greeting !== null) {
    lines.push({
      key: 'greeting',
      label: null,
      value: signature.greeting,
      href: null,
    });
  }

  const trimmedSenderName = senderName.trim();

  if (trimmedSenderName !== '') {
    lines.push({
      key: 'sender',
      label: null,
      value: trimmedSenderName,
      href: null,
    });
  }

  if (signature.companyName !== null) {
    lines.push({
      key: 'company',
      label: null,
      value: signature.companyName,
      href: null,
    });
  }

  if (signature.phone !== null) {
    lines.push({
      key: 'phone',
      label: 'Phone',
      value: signature.phone,
      href: null,
    });
  }

  if (signature.website !== null) {
    lines.push({
      key: 'website',
      label: 'Website',
      value: signature.website,
      href: safeHttpUrl(signature.website),
    });
  }

  if (signature.whatsapp !== null) {
    lines.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      value: signature.whatsapp,
      href: safeHttpUrl(signature.whatsapp),
    });
  }

  return lines;
}

function composeText(input: OutreachMessageInput): string {
  const blocks: string[] = [];
  const body = input.body.trim();

  if (body !== '') {
    blocks.push(body);
  }

  const signatureParts: string[] = [];

  for (const line of buildOutreachSignatureLines(
    input.signature,
    input.senderName,
  )) {
    signatureParts.push(
      line.label === null ? line.value : `${line.label}: ${line.value}`,
    );
  }

  if (input.signature.text !== null) {
    if (signatureParts.length > 0) {
      signatureParts.push('');
    }

    signatureParts.push(input.signature.text);
  }

  if (signatureParts.length > 0) {
    blocks.push(signatureParts.join('\n'));
  }

  return blocks.join('\n\n');
}

function composeHtml(input: OutreachMessageInput): string {
  const blocks: string[] = [];
  const body = input.body.trim();

  if (body !== '') {
    blocks.push(`<div>${renderHtmlText(body)}</div>`);
  }

  const signatureBlocks = buildOutreachSignatureLines(
    input.signature,
    input.senderName,
  ).map((line) => {
    const label =
      line.label === null
        ? ''
        : `<span style="color:#555555;">${escapeHtml(line.label)}: </span>`;
    const value =
      line.href === null
        ? escapeHtml(line.value)
        : `<a href="${escapeHtml(line.href)}">${escapeHtml(line.value)}</a>`;

    return `<div>${label}${value}</div>`;
  });

  if (input.signature.text !== null) {
    signatureBlocks.push(
      `<div style="margin-top:12px;">${renderHtmlText(input.signature.text)}</div>`,
    );
  }

  if (signatureBlocks.length > 0) {
    blocks.push(
      `<div style="margin-top:16px;">${signatureBlocks.join('')}</div>`,
    );
  }

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111111;">${blocks.join('')}</div>`;
}

/** Builds the complete message. Pure and independent of the transport. */
export function buildOutreachEmail(
  input: OutreachMessageInput,
): ComposedOutreachEmail {
  return {
    from: { name: input.senderName, address: input.senderEmail },
    to: input.recipient,
    subject: input.subject,
    text: composeText(input),
    html: composeHtml(input),
    attachments: input.attachments,
  };
}

/** Injectable wrapper so future senders can compose through Nest DI. */
@Injectable()
export class OutreachMessageBuilder {
  build(input: OutreachMessageInput): ComposedOutreachEmail {
    return buildOutreachEmail(input);
  }
}
