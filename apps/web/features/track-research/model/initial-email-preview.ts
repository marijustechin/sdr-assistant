import {
  hasSignatureContent,
  type EmailAccountSignature,
} from '@/entities/email-account/client';
import type {
  AttachmentLimits,
  ResearchAttachment,
} from '@/entities/research/client';
import { toHttpUrl } from '@/shared/lib/url';

/**
 * One rendered line of an email signature. `href` is non-null only for a
 * validated HTTP(S) link; every other line is plain text.
 */
export type SignatureLine = {
  readonly key:
    'greeting' | 'sender' | 'company' | 'phone' | 'website' | 'whatsapp';
  readonly label: string | null;
  readonly value: string;
  readonly href: string | null;
};

/**
 * Builds the signature lines in the approved display order:
 *
 * 1. closing greeting (`signatureName`);
 * 2. sender name (the account's existing `senderName`, reused — not a separate
 *    signature field);
 * 3. company name;
 * 4. telephone;
 * 5. website;
 * 6. WhatsApp.
 *
 * The additional signature text is rendered by the caller after these lines. A
 * missing field contributes no line, and an account without any signature
 * content renders nothing at all, so a lone sender name never becomes a
 * signature. Website and WhatsApp are re-validated here even though the API
 * validates them, so a bad stored value can never become an anchor.
 */
export function signatureLines(
  signature: EmailAccountSignature | null,
  senderName: string | null,
): SignatureLine[] {
  if (signature === null || !hasSignatureContent(signature)) {
    return [];
  }

  const lines: SignatureLine[] = [];

  // `signatureName` is the owner-authored closing greeting. It is displayed
  // first, before the sender's name.
  if (signature.name !== null) {
    lines.push({
      key: 'greeting',
      label: null,
      value: signature.name,
      href: null,
    });
  }

  // The sender name is the account's existing field, reused here instead of
  // adding a second, signature-only name field.
  const trimmedSenderName = senderName?.trim() ?? '';

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
      href: toHttpUrl(signature.website),
    });
  }

  if (signature.whatsapp !== null) {
    lines.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      value: signature.whatsapp,
      href: toHttpUrl(signature.whatsapp),
    });
  }

  return lines;
}

/** Short human-readable file size, shared by the list and the preview. */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentTotalBytes(
  attachments: readonly ResearchAttachment[],
): number {
  return attachments.reduce(
    (total, attachment) => total + attachment.sizeBytes,
    0,
  );
}

export type AttachmentSelectionCheck =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Client-side mirror of the API limits. It gives immediate feedback; the API
 * enforces the same rules again and stays authoritative.
 */
export function checkAttachmentSelection(
  attachments: readonly ResearchAttachment[],
  limits: AttachmentLimits,
  sizeBytes: number,
): AttachmentSelectionCheck {
  if (sizeBytes === 0) {
    return { ok: false, message: 'The selected file is empty.' };
  }

  if (sizeBytes > limits.maxFileBytes) {
    return {
      ok: false,
      message: `Each attachment must be at most ${formatAttachmentSize(limits.maxFileBytes)}.`,
    };
  }

  if (attachments.length >= limits.maxAttachments) {
    return {
      ok: false,
      message: `A research can have at most ${limits.maxAttachments} attachments.`,
    };
  }

  if (attachmentTotalBytes(attachments) + sizeBytes > limits.maxTotalBytes) {
    return {
      ok: false,
      message: `The attachments of one research must total at most ${formatAttachmentSize(limits.maxTotalBytes)}.`,
    };
  }

  return { ok: true };
}
