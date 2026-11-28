import { Module } from '@nestjs/common';

import { MAIL_DESTINATION_RESOLVER } from '../email-accounts/email-connection.tokens.js';
import { SystemMailDestinationResolver } from '../email-accounts/mail-destination.js';
import { OutreachMessageBuilder } from './outreach-message.builder.js';
import { SMTP_MAIL_SENDER } from './outreach-email.tokens.js';
import { NodemailerSmtpMailSender } from './smtp-mail-sender.js';
import { TestEmailSendController } from './test-email-send.controller.js';
import { TestEmailSendService } from './test-email-send.service.js';

/**
 * Outreach email composition and delivery.
 *
 * The message builder and the SMTP sender are exported so the future
 * first-contact execution (SDR-012) can reuse them without reimplementing
 * message construction or transport security.
 */
@Module({
  controllers: [TestEmailSendController],
  providers: [
    OutreachMessageBuilder,
    TestEmailSendService,
    {
      provide: MAIL_DESTINATION_RESOLVER,
      useFactory: () => new SystemMailDestinationResolver(),
    },
    {
      provide: SMTP_MAIL_SENDER,
      useFactory: () => new NodemailerSmtpMailSender(),
    },
  ],
  exports: [OutreachMessageBuilder, SMTP_MAIL_SENDER],
})
export class OutreachEmailModule {}
