import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { decryptCredential, readEncryptionKey } from './credential-encryption.js';
import {
  CONNECTION_VERIFICATION_TIMEOUTS,
  isAllowedMailPort,
  type ConnectionVerificationTarget,
  type EmailVerificationFailureCode,
  type EmailVerificationStatus,
  type MailProtocol,
} from './email-connection.constants.js';
import { classifyConnectionFailure } from './email-connection-errors.js';
import {
  IMAP_CONNECTION_VERIFIER,
  MAIL_DESTINATION_RESOLVER,
  SMTP_CONNECTION_VERIFIER,
} from './email-connection.tokens.js';
import {
  toEmailAccountResponse,
  type EmailAccountResponse,
  type EmailAccountRow,
} from './email-accounts.mapper.js';
import type { ImapConnectionVerifier } from './imap-connection-verifier.js';
import {
  MailDestinationError,
  type MailDestinationResolver,
  type ResolvedMailDestination,
} from './mail-destination.js';
import type { SmtpConnectionVerifier } from './smtp-connection-verifier.js';

export type ConnectionVerificationResult = {
  readonly accountId: string;
  readonly protocol: MailProtocol;
  /**
   * `CONFIGURATION_CHANGED` is not persisted: it says the saved configuration
   * was modified while the test ran, so the result describes nothing that is
   * stored any more.
   */
  readonly result: 'VERIFIED' | 'FAILED' | 'CONFIGURATION_CHANGED';
  readonly failureCode: EmailVerificationFailureCode | null;
  readonly lastCheckedAt: string | null;
  readonly account: EmailAccountResponse;
};

type VerificationOutcome =
  | { readonly status: 'VERIFIED' }
  | {
      readonly status: 'FAILED';
      readonly failureCode: EmailVerificationFailureCode;
    };

type ProtocolSettings = {
  readonly host: string;
  readonly port: number;
  readonly security: EmailAccountRow['smtpSecurity'];
  readonly username: string;
  readonly encryptedPassword: string;
};

function settingsFor(
  row: EmailAccountRow,
  protocol: MailProtocol,
): ProtocolSettings {
  return protocol === 'SMTP'
    ? {
        host: row.smtpHost,
        port: row.smtpPort,
        security: row.smtpSecurity,
        username: row.smtpUsername,
        encryptedPassword: row.smtpPasswordEncrypted,
      }
    : {
        host: row.imapHost,
        port: row.imapPort,
        security: row.imapSecurity,
        username: row.imapUsername,
        encryptedPassword: row.imapPasswordEncrypted,
      };
}

function failed(
  failureCode: EmailVerificationFailureCode,
): VerificationOutcome {
  return { status: 'FAILED', failureCode };
}

function persistenceData(
  protocol: MailProtocol,
  outcome: VerificationOutcome,
  checkedAt: Date,
):
  | {
      smtpVerificationStatus: EmailVerificationStatus;
      smtpLastCheckedAt: Date;
      smtpVerificationFailureCode: EmailVerificationFailureCode | null;
    }
  | {
      imapVerificationStatus: EmailVerificationStatus;
      imapLastCheckedAt: Date;
      imapVerificationFailureCode: EmailVerificationFailureCode | null;
    } {
  const failureCode =
    outcome.status === 'FAILED' ? outcome.failureCode : null;

  return protocol === 'SMTP'
    ? {
        smtpVerificationStatus: outcome.status,
        smtpLastCheckedAt: checkedAt,
        smtpVerificationFailureCode: failureCode,
      }
    : {
        imapVerificationStatus: outcome.status,
        imapLastCheckedAt: checkedAt,
        imapVerificationFailureCode: failureCode,
      };
}

/**
 * Saved-configuration connection verification for one account and protocol.
 *
 * The endpoint never accepts a destination or credential from the request: it
 * loads the stored row. Only the credential of the requested protocol is
 * decrypted, and only after the destination has passed validation. Overlapping
 * tests for the same account and protocol are rejected, and a result is written
 * only if the row still matches the configuration that was tested.
 */
@Injectable()
export class EmailConnectionVerificationService {
  private readonly logger = new Logger(
    EmailConnectionVerificationService.name,
  );

  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_DESTINATION_RESOLVER)
    private readonly destinationResolver: MailDestinationResolver,
    @Inject(SMTP_CONNECTION_VERIFIER)
    private readonly smtpVerifier: SmtpConnectionVerifier,
    @Inject(IMAP_CONNECTION_VERIFIER)
    private readonly imapVerifier: ImapConnectionVerifier,
  ) {}

  async verify(
    id: string,
    protocol: MailProtocol,
  ): Promise<ConnectionVerificationResult> {
    const lockKey = `${id}:${protocol}`;

    if (this.inFlight.has(lockKey)) {
      throw new ConflictException(
        'A connection test for this protocol is already running.',
      );
    }

    this.inFlight.add(lockKey);

    try {
      const row = await this.findRow(id);

      if (!row.enabled) {
        throw new ConflictException(
          'Disabled email accounts cannot be tested.',
        );
      }

      const outcome = await this.testSavedConfiguration(row, protocol);

      return await this.persistOutcome(id, protocol, row, outcome);
    } finally {
      this.inFlight.delete(lockKey);
    }
  }

  private async testSavedConfiguration(
    row: EmailAccountRow,
    protocol: MailProtocol,
  ): Promise<VerificationOutcome> {
    const settings = settingsFor(row, protocol);

    if (!isAllowedMailPort(protocol, settings.port)) {
      this.logger.warn(
        `${protocol} verification for email account ${row.id} failed: INVALID_CONFIGURATION`,
      );

      return failed('INVALID_CONFIGURATION');
    }

    let destination: ResolvedMailDestination;

    try {
      destination = await this.destinationResolver.resolve(
        settings.host,
        CONNECTION_VERIFICATION_TIMEOUTS.dnsLookupMs,
      );
    } catch (error) {
      const failureCode =
        error instanceof MailDestinationError
          ? error.failureCode
          : 'CONNECTION_FAILED';

      this.logger.warn(
        `${protocol} verification for email account ${row.id} failed: ${failureCode}`,
      );

      return failed(failureCode);
    }

    const password = this.decryptPassword(row, protocol);

    if (password === null) {
      return failed('CREDENTIAL_UNAVAILABLE');
    }

    const target: ConnectionVerificationTarget = {
      protocol,
      host: destination.host,
      address: destination.address,
      port: settings.port,
      security: settings.security,
      username: settings.username,
      password,
    };

    try {
      if (protocol === 'SMTP') {
        await this.smtpVerifier.verify(target);
      } else {
        await this.imapVerifier.verify(target);
      }

      return { status: 'VERIFIED' };
    } catch (error) {
      const failureCode = classifyConnectionFailure(error);

      // Only the safe code is logged; the raw error may carry a provider
      // response and is never emitted.
      this.logger.warn(
        `${protocol} verification for email account ${row.id} failed: ${failureCode}`,
      );

      return failed(failureCode);
    }
  }

  /**
   * Decrypts the credential of the requested protocol only. A missing key or a
   * corrupted payload is an expected failed verification, not a 500: the result
   * says the saved credential could not be used and no credential material is
   * logged or returned.
   */
  private decryptPassword(
    row: EmailAccountRow,
    protocol: MailProtocol,
  ): string | null {
    const settings = settingsFor(row, protocol);

    if (settings.encryptedPassword === '') {
      return null;
    }

    try {
      return decryptCredential(settings.encryptedPassword, readEncryptionKey());
    } catch {
      this.logger.error(
        `Email-account credential decryption is unavailable for ${protocol} verification of email account ${row.id}.`,
      );

      return null;
    }
  }

  private async persistOutcome(
    id: string,
    protocol: MailProtocol,
    tested: EmailAccountRow,
    outcome: VerificationOutcome,
  ): Promise<ConnectionVerificationResult> {
    const checkedAt = new Date();
    const data = persistenceData(protocol, outcome, checkedAt);
    const where =
      protocol === 'SMTP'
        ? {
            id,
            enabled: true,
            smtpHost: tested.smtpHost,
            smtpPort: tested.smtpPort,
            smtpSecurity: tested.smtpSecurity,
            smtpUsername: tested.smtpUsername,
            smtpPasswordEncrypted: tested.smtpPasswordEncrypted,
          }
        : {
            id,
            enabled: true,
            imapHost: tested.imapHost,
            imapPort: tested.imapPort,
            imapSecurity: tested.imapSecurity,
            imapUsername: tested.imapUsername,
            imapPasswordEncrypted: tested.imapPasswordEncrypted,
          };

    // Conditional write: a configuration or credential change, or a disable,
    // between the test and this update leaves the stored result untouched. The
    // account is never re-enabled here.
    const updatedCount = await this.prisma.emailAccount.updateMany({
      where,
      data,
    });

    const current = await this.findRow(id);

    if (updatedCount.count === 0) {
      return {
        accountId: id,
        protocol,
        result: 'CONFIGURATION_CHANGED',
        failureCode: null,
        lastCheckedAt: null,
        account: toEmailAccountResponse(current),
      };
    }

    return {
      accountId: id,
      protocol,
      result: outcome.status,
      failureCode:
        outcome.status === 'FAILED' ? outcome.failureCode : null,
      lastCheckedAt: checkedAt.toISOString(),
      account: toEmailAccountResponse(current),
    };
  }

  private async findRow(id: string): Promise<EmailAccountRow> {
    const row = await this.prisma.emailAccount.findUnique({ where: { id } });

    if (row === null) {
      throw new NotFoundException(`Email account ${id} not found`);
    }

    return row;
  }
}
