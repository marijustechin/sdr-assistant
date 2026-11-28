import {
  hasSignatureContent,
  type EmailAccountSignature,
} from '@/entities/email-account/client';
import type { ResearchAttachment } from '@/entities/research/client';

import {
  formatAttachmentSize,
  signatureLines,
} from '../model/initial-email-preview';

type SignatureBlockProps = {
  readonly signature: EmailAccountSignature;
  /** The account's existing sender name, rendered after the closing greeting. */
  readonly senderName: string | null;
};

/**
 * The reusable signature exactly as it will appear in the sent email: closing
 * greeting, sender name, company, telephone, website, WhatsApp and the optional
 * additional text. Links are rendered as anchors only when the stored value is a
 * validated HTTP(S) URL.
 */
export function SignatureBlock({ signature, senderName }: SignatureBlockProps) {
  const lines = signatureLines(signature, senderName);

  return (
    <div className="email-signature">
      {lines.map((line) => (
        <p key={line.key}>
          {line.label !== null && (
            <span className="email-signature-label">{line.label}: </span>
          )}
          {line.href === null ? (
            <span>{line.value}</span>
          ) : (
            <a href={line.href} target="_blank" rel="noopener noreferrer">
              {line.value}
            </a>
          )}
        </p>
      ))}

      {signature.text !== null && (
        <p className="email-signature-text">{signature.text}</p>
      )}
    </div>
  );
}

type InitialEmailPreviewProps = {
  readonly subject: string;
  readonly body: string;
  readonly signature: EmailAccountSignature | null;
  readonly senderName: string | null;
  readonly attachments: readonly ResearchAttachment[];
};

/**
 * Read-only preview of the complete initial email: subject, the owner-authored
 * message, the assigned account's signature and the attachment list. It is
 * rendered as React text, never as HTML, so no message or signature value can
 * inject markup.
 */
export function InitialEmailPreview({
  subject,
  body,
  signature,
  senderName,
  attachments,
}: InitialEmailPreviewProps) {
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  // The structured lines and the free-text note are independent parts of one
  // signature block; either alone is enough to render it.
  const hasSignature = signature !== null && hasSignatureContent(signature);

  return (
    <div className="email-preview">
      <div className="email-preview-subject">
        <span className="hint">Subject</span>
        <p>
          {trimmedSubject === '' ? (
            <span className="muted">No subject yet</span>
          ) : (
            trimmedSubject
          )}
        </p>
      </div>

      <div className="email-preview-body">
        {trimmedBody === '' ? (
          <p className="muted">No message yet</p>
        ) : (
          <p>{body}</p>
        )}
      </div>

      {hasSignature && signature !== null && (
        <div className="email-preview-signature">
          <SignatureBlock signature={signature} senderName={senderName} />
        </div>
      )}

      <div className="email-preview-attachments">
        <p className="hint">Attachments ({attachments.length})</p>

        {attachments.length === 0 ? (
          <p className="muted">No attachments.</p>
        ) : (
          <ul className="attachment-list email-attachment-list">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="attachment-row">
                <span className="attachment-name">{attachment.filename}</span>
                <span className="muted">
                  {formatAttachmentSize(attachment.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
