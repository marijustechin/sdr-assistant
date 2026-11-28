import { Buffer } from 'node:buffer';

import nodemailer, {
  type SMTPTransportOptions,
  type SendMailOptions,
  type SentMessageInfo,
} from 'nodemailer';

import {
  classifyConnectionFailure,
  withConnectionTimeout,
} from '../email-accounts/email-connection-errors.js';
import {
  testEmailFailureMessage,
  type ComposedOutreachEmail,
  type TestEmailFailureCode,
} from './outreach-email.types.js';

/**
 * SMTP delivery of one already-composed outreach message.
 *
 * The transport mirrors the hardened connection verification: the socket is
 * opened to the already-validated public IP, the TLS server name stays the
 * configured hostname, certificates are verified, STARTTLS is required when
 * configured and authentication is forced. The sender never retries: a failure
 * is reported as a definite failure or as an uncertain acceptance.
 */
export type SmtpSendTarget = {
  /** Configured hostname, used for TLS server-name and certificate validation. */
  readonly host: string;
  /** Validated public IP the socket connects to. */
  readonly address: string;
  readonly port: number;
  readonly security: 'TLS' | 'STARTTLS';
  readonly username: string;
  readonly password: string;
};

export type SmtpSendFailure = {
  readonly status: 'FAILED';
  readonly failureCode: TestEmailFailureCode;
  readonly message: string;
  /**
   * True when the transport failed without a definitive server answer, so the
   * message may or may not have been accepted. The caller must not retry
   * automatically.
   */
  readonly uncertain: boolean;
  readonly smtpResponseCode?: number;
};

export type SmtpSendOutcome = { readonly status: 'SENT' } | SmtpSendFailure;

export interface SmtpMailSender {
  send(
    message: ComposedOutreachEmail,
    target: SmtpSendTarget,
  ): Promise<SmtpSendOutcome>;
}

export type SmtpSendTransportLike = {
  sendMail(mail: SendMailOptions): Promise<SentMessageInfo>;
  close(): void;
};

export type SmtpSendTransportFactory = (
  options: SMTPTransportOptions,
) => SmtpSendTransportLike;

/** Hard ceiling for one send attempt, including authentication and DATA. */
export const SMTP_SEND_TIMEOUTS = {
  connectionMs: 8_000,
  greetingMs: 8_000,
  socketMs: 20_000,
  overallMs: 60_000,
} as const;

function createNodemailerTransport(
  options: SMTPTransportOptions,
): SmtpSendTransportLike {
  return nodemailer.createTransport(options);
}

function asRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)
    : null;
}

function readResponseCode(error: unknown): number | undefined {
  const value = asRecord(error)?.['responseCode'];

  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

const AUTH_RESPONSE_CODES = new Set([454, 530, 534, 535, 538]);

function definiteFailure(
  failureCode: TestEmailFailureCode,
  smtpResponseCode?: number,
): SmtpSendFailure {
  return {
    status: 'FAILED',
    failureCode,
    message: testEmailFailureMessage(failureCode, smtpResponseCode),
    uncertain: false,
    ...(smtpResponseCode === undefined ? {} : { smtpResponseCode }),
  };
}

/**
 * Classifies a transport error without ever inspecting or returning the raw
 * provider response.
 *
 * Authentication, DNS, refused connections and TLS failures are definitive: no
 * message was accepted. A numeric SMTP reply is a definitive rejection. Any
 * other failure (timeout, socket reset, unknown transport error) could have
 * happened after the server accepted the data, so it is reported as uncertain
 * rather than retried.
 */
export function classifySendFailure(error: unknown): SmtpSendFailure {
  const responseCode = readResponseCode(error);

  if (responseCode !== undefined) {
    return definiteFailure(
      AUTH_RESPONSE_CODES.has(responseCode)
        ? 'AUTHENTICATION_FAILED'
        : 'SMTP_REJECTED',
      responseCode,
    );
  }

  const failureCode = classifyConnectionFailure(error);

  if (
    failureCode === 'CONNECTION_TIMEOUT' ||
    failureCode === 'CONNECTION_FAILED'
  ) {
    return {
      status: 'FAILED',
      failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN',
      message: testEmailFailureMessage('SMTP_ACCEPTANCE_UNCERTAIN'),
      uncertain: true,
    };
  }

  return definiteFailure(failureCode);
}

function addressOf(entry: unknown): string | null {
  if (typeof entry === 'string') {
    return entry;
  }

  const address = asRecord(entry)?.['address'];

  return typeof address === 'string' ? address : null;
}

/**
 * Reads the transport result. `accepted` is the server's definitively accepted
 * envelope; a non-empty `rejected` list without any acceptance is a rejection.
 * Anything else leaves delivery unconfirmed.
 */
export function evaluateSendInfo(
  info: SentMessageInfo,
  recipient: string,
): SmtpSendOutcome {
  const record = asRecord(info);
  const accepted = Array.isArray(record?.['accepted']) ? record.accepted : [];
  const rejected = Array.isArray(record?.['rejected']) ? record.rejected : [];
  const normalizedRecipient = recipient.toLowerCase();
  const acceptedRecipient = accepted.some(
    (entry) => addressOf(entry)?.toLowerCase() === normalizedRecipient,
  );

  if (acceptedRecipient || (accepted.length > 0 && rejected.length === 0)) {
    return { status: 'SENT' };
  }

  if (rejected.length > 0) {
    return definiteFailure('SMTP_REJECTED');
  }

  return {
    status: 'FAILED',
    failureCode: 'SMTP_ACCEPTANCE_UNCERTAIN',
    message: testEmailFailureMessage('SMTP_ACCEPTANCE_UNCERTAIN'),
    uncertain: true,
  };
}

export class NodemailerSmtpMailSender implements SmtpMailSender {
  constructor(
    private readonly createTransport: SmtpSendTransportFactory = createNodemailerTransport,
    private readonly timeouts: typeof SMTP_SEND_TIMEOUTS = SMTP_SEND_TIMEOUTS,
  ) {}

  async send(
    message: ComposedOutreachEmail,
    target: SmtpSendTarget,
  ): Promise<SmtpSendOutcome> {
    let transporter: SmtpSendTransportLike | null = null;

    try {
      transporter = this.createTransport({
        host: target.address,
        port: target.port,
        secure: target.security === 'TLS',
        requireTLS: target.security === 'STARTTLS',
        servername: target.host,
        auth: {
          user: target.username,
          pass: target.password,
        },
        forceAuth: true,
        tls: {
          rejectUnauthorized: true,
          servername: target.host,
        },
        connectionTimeout: this.timeouts.connectionMs,
        greetingTimeout: this.timeouts.greetingMs,
        socketTimeout: this.timeouts.socketMs,
        dnsTimeout: 5_000,
        allowInternalNetworkInterfaces: false,
        logger: false,
        debug: false,
      });

      const info = await withConnectionTimeout(
        transporter.sendMail({
          from: {
            name: message.from.name,
            address: message.from.address,
          },
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          attachments: message.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: Buffer.from(attachment.content),
            contentType: attachment.contentType,
          })),
        }),
        this.timeouts.overallMs,
      );

      return evaluateSendInfo(info, message.to);
    } catch (error) {
      return classifySendFailure(error);
    } finally {
      transporter?.close();
    }
  }
}
