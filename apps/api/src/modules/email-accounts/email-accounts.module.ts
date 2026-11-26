import { Module } from '@nestjs/common';

import { EmailConnectionVerificationService } from './email-connection-verification.service.js';
import {
  IMAP_CONNECTION_VERIFIER,
  MAIL_DESTINATION_RESOLVER,
  SMTP_CONNECTION_VERIFIER,
} from './email-connection.tokens.js';
import { EmailAccountsController } from './email-accounts.controller.js';
import { EmailAccountsService } from './email-accounts.service.js';
import { ImapFlowConnectionVerifier } from './imap-connection-verifier.js';
import { SystemMailDestinationResolver } from './mail-destination.js';
import { NodemailerSmtpConnectionVerifier } from './smtp-connection-verifier.js';

@Module({
  controllers: [EmailAccountsController],
  providers: [
    EmailAccountsService,
    EmailConnectionVerificationService,
    {
      provide: MAIL_DESTINATION_RESOLVER,
      useFactory: () => new SystemMailDestinationResolver(),
    },
    {
      provide: SMTP_CONNECTION_VERIFIER,
      useFactory: () => new NodemailerSmtpConnectionVerifier(),
    },
    {
      provide: IMAP_CONNECTION_VERIFIER,
      useFactory: () => new ImapFlowConnectionVerifier(),
    },
  ],
})
export class EmailAccountsModule {}
