import { Socket } from 'node:net';

import nodemailer, { type SMTPTransportOptions } from 'nodemailer';

import {
  CONNECTION_VERIFICATION_TIMEOUTS,
  SMTP_VERIFICATION_TIMEOUTS,
  type ConnectionVerificationTarget,
  type ConnectionVerificationTimeouts,
} from './email-connection.constants.js';
import { withConnectionTimeout } from './email-connection-errors.js';

/**
 * SMTP connection verification through Nodemailer's `verify()`.
 *
 * `verify()` connects, negotiates TLS and authenticates; it never sends a
 * message and never runs `MAIL FROM`, `RCPT TO` or `DATA`.
 *
 * Security properties of the transport:
 * - `TLS` means implicit TLS (`secure: true`); `STARTTLS` forces the upgrade
 *   before AUTH (`requireTLS: true`), so a server without STARTTLS fails.
 * - certificate and host-name validation stay enabled (`rejectUnauthorized`),
 *   and the TLS server name is always the configured host, even though the
 *   socket is opened to the already-validated IP address.
 * - `forceAuth` makes verify() authenticate even against a server that does
 *   not advertise AUTH, so a connection without authentication cannot verify.
 * - the socket is created here and passed to Nodemailer, so the adapter can
 *   destroy it on every path; `transporter.close()` runs afterwards.
 */
export type SmtpTransportLike = {
  verify(): Promise<unknown>;
  close(): void;
};

export type SmtpTransportFactory = (
  options: SMTPTransportOptions,
) => SmtpTransportLike;

export interface SmtpConnectionVerifier {
  verify(target: ConnectionVerificationTarget): Promise<void>;
}

function createNodemailerTransport(
  options: SMTPTransportOptions,
): SmtpTransportLike {
  return nodemailer.createTransport(options);
}

export class NodemailerSmtpConnectionVerifier
  implements SmtpConnectionVerifier
{
  constructor(
    private readonly createTransport: SmtpTransportFactory = createNodemailerTransport,
    private readonly timeouts: ConnectionVerificationTimeouts = SMTP_VERIFICATION_TIMEOUTS,
  ) {}

  async verify(target: ConnectionVerificationTarget): Promise<void> {
    const socket = new Socket();
    let transporter: SmtpTransportLike | null = null;

    try {
      transporter = this.createTransport({
        host: target.address,
        port: target.port,
        secure: target.security === 'TLS',
        requireTLS: target.security === 'STARTTLS',
        servername: target.host,
        socket,
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
        dnsTimeout: CONNECTION_VERIFICATION_TIMEOUTS.dnsLookupMs,
        allowInternalNetworkInterfaces: false,
        logger: false,
        debug: false,
      });

      await withConnectionTimeout(
        transporter.verify(),
        this.timeouts.overallMs,
      );
    } finally {
      socket.destroy();
      transporter?.close();
    }
  }
}
