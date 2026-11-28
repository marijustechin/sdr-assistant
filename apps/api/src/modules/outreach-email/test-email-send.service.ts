import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { decryptCredential, readEncryptionKey } from '../email-accounts/credential-encryption.js';
import {
  CONNECTION_VERIFICATION_TIMEOUTS,
  isAllowedMailPort,
} from '../email-accounts/email-connection.constants.js';
import {
  MAIL_DESTINATION_RESOLVER,
} from '../email-accounts/email-connection.tokens.js';
import {
  MailDestinationError,
  type MailDestinationResolver,
  type ResolvedMailDestination,
} from '../email-accounts/mail-destination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutreachMessageBuilder } from './outreach-message.builder.js';
import { SMTP_MAIL_SENDER } from './outreach-email.tokens.js';
import {
  testEmailFailureMessage,
  type OutreachAttachment,
  type OutreachSignature,
  type TestEmailFailureCode,
} from './outreach-email.types.js';
import type { SmtpMailSender } from './smtp-mail-sender.js';

export type TestEmailSendResult =
  | {
      readonly outcome: 'SENT';
      readonly recipient: string;
      readonly recorded: boolean;
      readonly completedAt: string;
    }
  | {
      readonly outcome: 'FAILED';
      readonly recipient: string;
      readonly failureCode: TestEmailFailureCode;
      readonly message: string;
      readonly uncertain: boolean;
      readonly recorded: boolean;
      readonly completedAt: string;
    };

type AttemptOutcome =
  | { readonly status: 'SENT' }
  | {
      readonly status: 'FAILED';
      readonly failureCode: TestEmailFailureCode;
      readonly message: string;
      readonly uncertain: boolean;
    };

type SendContext = {
  readonly emailAccountId: string;
  readonly senderEmail: string;
  readonly subject: string;
  readonly attachmentCount: number;
  readonly recipient: string;
};

function safeErrorCode(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;

  return typeof code === 'string' ? code : 'unknown';
}

/**
 * Sends exactly one owner-triggered test email through the research's assigned
 * account and records the attempt separately from first-contact communication.
 *
 * It never touches the prepared recipient queue, never updates first-contact
 * statistics and never triggers automatic communication. One send per research
 * may be in flight at a time, so a double click cannot produce two messages.
 * Failed sending is never retried automatically: a definitive failure is
 * reported as such, and an unconfirmed SMTP result is reported as uncertain.
 */
@Injectable()
export class TestEmailSendService {
  private readonly logger = new Logger(TestEmailSendService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageBuilder: OutreachMessageBuilder,
    @Inject(MAIL_DESTINATION_RESOLVER)
    private readonly destinationResolver: MailDestinationResolver,
    @Inject(SMTP_MAIL_SENDER)
    private readonly mailSender: SmtpMailSender,
  ) {}

  async send(jobId: string, recipient: string): Promise<TestEmailSendResult> {
    if (this.inFlight.has(jobId)) {
      throw new ConflictException(
        'A test email is already being sent for this research.',
      );
    }

    this.inFlight.add(jobId);

    try {
      const research = await this.prisma.research.findUnique({
        where: { id: jobId },
        select: { id: true },
      });

      if (research === null) {
        throw new NotFoundException(`Research ${jobId} not found`);
      }

      const settings =
        await this.prisma.researchCommunicationSettings.findUnique({
          where: { researchId: jobId },
          select: {
            emailAccountId: true,
            initialEmailSubject: true,
            initialEmailBody: true,
          },
        });

      if (settings?.emailAccountId === null || settings === null) {
        throw new ConflictException(
          'Assign an email account to this research before sending a test.',
        );
      }

      if (
        settings.initialEmailSubject === null ||
        settings.initialEmailBody === null
      ) {
        throw new ConflictException(
          'Save the initial email before sending a test.',
        );
      }

      const account = await this.prisma.emailAccount.findUnique({
        where: { id: settings.emailAccountId },
      });

      if (account === null) {
        throw new ConflictException(
          'The assigned email account is no longer available.',
        );
      }

      if (!account.enabled) {
        throw new ConflictException(
          'Only enabled email accounts can send email.',
        );
      }

      const attachmentRows = await this.prisma.researchAttachment.findMany({
        where: { researchId: jobId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { filename: true, mimeType: true, content: true },
      });

      const attachments: OutreachAttachment[] = attachmentRows.map((row) => ({
        filename: row.filename,
        contentType: row.mimeType,
        content: row.content,
      }));

      const signature: OutreachSignature = {
        greeting: account.signatureName,
        companyName: account.signatureCompany,
        phone: account.signaturePhone,
        website: account.signatureWebsite,
        whatsapp: account.signatureWhatsapp,
        text: account.signatureText,
      };

      const context: SendContext = {
        emailAccountId: account.id,
        senderEmail: account.emailAddress,
        subject: settings.initialEmailSubject,
        attachmentCount: attachments.length,
        recipient,
      };

      if (!isAllowedMailPort('SMTP', account.smtpPort)) {
        return this.finish(
          context,
          {
            status: 'FAILED',
            failureCode: 'INVALID_CONFIGURATION',
            message: testEmailFailureMessage('INVALID_CONFIGURATION'),
            uncertain: false,
          },
          jobId,
        );
      }

      let destination: ResolvedMailDestination;

      try {
        destination = await this.destinationResolver.resolve(
          account.smtpHost,
          CONNECTION_VERIFICATION_TIMEOUTS.dnsLookupMs,
        );
      } catch (error) {
        const failureCode: TestEmailFailureCode =
          error instanceof MailDestinationError
            ? error.failureCode
            : 'CONNECTION_FAILED';

        return this.finish(
          context,
          {
            status: 'FAILED',
            failureCode,
            message: testEmailFailureMessage(failureCode),
            uncertain: false,
          },
          jobId,
        );
      }

      let password: string;

      try {
        password = decryptCredential(
          account.smtpPasswordEncrypted,
          readEncryptionKey(),
        );
      } catch {
        this.logger.error(
          `Test email for research ${jobId} cannot decrypt the SMTP credential.`,
        );

        return this.finish(
          context,
          {
            status: 'FAILED',
            failureCode: 'CREDENTIAL_UNAVAILABLE',
            message: testEmailFailureMessage('CREDENTIAL_UNAVAILABLE'),
            uncertain: false,
          },
          jobId,
        );
      }

      const message = this.messageBuilder.build({
        senderName: account.senderName,
        senderEmail: account.emailAddress,
        recipient,
        subject: settings.initialEmailSubject,
        body: settings.initialEmailBody,
        signature,
        attachments,
      });

      const outcome = await this.mailSender.send(message, {
        host: destination.host,
        address: destination.address,
        port: account.smtpPort,
        security: account.smtpSecurity,
        username: account.smtpUsername,
        password,
      });

      return this.finish(
        context,
        outcome.status === 'SENT'
          ? { status: 'SENT' }
          : {
              status: 'FAILED',
              failureCode: outcome.failureCode,
              message: outcome.message,
              uncertain: outcome.uncertain,
            },
        jobId,
      );
    } finally {
      this.inFlight.delete(jobId);
    }
  }

  private async finish(
    context: SendContext,
    outcome: AttemptOutcome,
    jobId: string,
  ): Promise<TestEmailSendResult> {
    const completedAt = new Date().toISOString();
    const recorded = await this.recordAttempt(context, outcome, jobId);

    if (outcome.status === 'SENT') {
      return {
        outcome: 'SENT',
        recipient: context.recipient,
        recorded,
        completedAt,
      };
    }

    return {
      outcome: 'FAILED',
      recipient: context.recipient,
      failureCode: outcome.failureCode,
      message: outcome.message,
      uncertain: outcome.uncertain,
      recorded,
      completedAt,
    };
  }

  /**
   * Persists one attempt. A recording failure never changes the send result:
   * after the SMTP exchange has finished the email cannot be unsent, so a
   * database problem is logged and the outcome is returned with
   * `recorded: false`.
   */
  private async recordAttempt(
    context: SendContext,
    outcome: AttemptOutcome,
    jobId: string,
  ): Promise<boolean> {
    try {
      await this.prisma.researchTestEmailSend.create({
        data: {
          researchId: jobId,
          emailAccountId: context.emailAccountId,
          senderEmail: context.senderEmail,
          recipient: context.recipient,
          subject: context.subject,
          attachmentCount: context.attachmentCount,
          status: outcome.status,
          failureCode:
            outcome.status === 'FAILED' ? outcome.failureCode : null,
          failureMessage:
            outcome.status === 'FAILED' ? outcome.message : null,
        },
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Test email attempt for research ${jobId} could not be recorded (${safeErrorCode(error)}).`,
      );

      return false;
    }
  }
}
