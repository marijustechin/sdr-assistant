import { ImapFlow, type ImapFlowOptions } from 'imapflow';

import {
  IMAP_VERIFICATION_TIMEOUTS,
  type ConnectionVerificationTarget,
  type ConnectionVerificationTimeouts,
} from './email-connection.constants.js';
import { withConnectionTimeout } from './email-connection-errors.js';

/**
 * IMAP connection verification through ImapFlow.
 *
 * `verifyOnly` authenticates and then logs out from `connect()`: it never opens
 * or selects a mailbox and, because `includeMailboxes` stays false, it does not
 * even list mailboxes. `TLS` means implicit TLS; `STARTTLS` sets
 * `doSTARTTLS: true`, which makes a missing upgrade a hard failure instead of a
 * plaintext fallback. Raw logging and log events are disabled, and the socket is
 * always closed.
 *
 * ImapFlow 2.12.2 leaves `greeting` unset only for a `PREAUTH` greeting: its
 * `initialOK` handler always assigns the greeting string (possibly an empty
 * string), while `initialPREAUTH` sets the authenticated state without touching
 * `greeting`, and `close()` does not clear it. A `PREAUTH` connection therefore
 * reaches a successful `verifyOnly` connect without using the saved credentials.
 * The adapter rejects that state with the existing authentication-failure shape
 * so it is classified as `AUTHENTICATION_FAILED`.
 */
export type ImapClientLike = {
  readonly greeting: string | undefined;
  connect(): Promise<void>;
  logout(): Promise<void>;
  close(): void;
};

export type ImapClientFactory = (options: ImapFlowOptions) => ImapClientLike;

export interface ImapConnectionVerifier {
  verify(target: ConnectionVerificationTarget): Promise<void>;
}

/**
 * A connection that the server pre-authenticated without checking the saved
 * username and password. It carries the same `authenticationFailed` marker as an
 * ImapFlow `AuthenticationFailure`, so the existing classifier maps it to the
 * existing safe `AUTHENTICATION_FAILED` result without an API change.
 */
export class ImapCredentialVerificationError extends Error {
  readonly authenticationFailed = true;

  constructor() {
    super(
      'The IMAP server pre-authenticated the connection without verifying the saved credentials.',
    );
    this.name = 'ImapCredentialVerificationError';
  }
}

function createImapFlowClient(options: ImapFlowOptions): ImapClientLike {
  return new ImapFlow(options);
}

export class ImapFlowConnectionVerifier implements ImapConnectionVerifier {
  constructor(
    private readonly createClient: ImapClientFactory = createImapFlowClient,
    private readonly timeouts: ConnectionVerificationTimeouts = IMAP_VERIFICATION_TIMEOUTS,
  ) {}

  async verify(target: ConnectionVerificationTarget): Promise<void> {
    const client = this.createClient({
      host: target.address,
      port: target.port,
      secure: target.security === 'TLS',
      ...(target.security === 'STARTTLS' ? { doSTARTTLS: true } : {}),
      servername: target.host,
      auth: {
        user: target.username,
        pass: target.password,
      },
      tls: {
        rejectUnauthorized: true,
        servername: target.host,
      },
      logger: false,
      logRaw: false,
      emitLogs: false,
      verifyOnly: true,
      includeMailboxes: false,
      disableAutoIdle: true,
      disableAutoEnable: true,
      disableCompression: true,
      connectionTimeout: this.timeouts.connectionMs,
      greetingTimeout: this.timeouts.greetingMs,
      socketTimeout: this.timeouts.socketMs,
    });

    try {
      await withConnectionTimeout(client.connect(), this.timeouts.overallMs);

      if (client.greeting === undefined) {
        throw new ImapCredentialVerificationError();
      }
    } finally {
      client.close();
    }
  }
}
