import { Body, Controller, Param, Post } from '@nestjs/common';

import { SendTestEmailDto } from './dto/send-test-email.dto.js';
import { TestEmailSendService } from './test-email-send.service.js';

/**
 * Owner-triggered test email.
 *
 * Sends exactly one message to a manually entered recipient through the
 * research's assigned account, records the attempt separately from first-contact
 * communication and never touches the prepared recipient queue.
 */
@Controller('research/:jobId/communication/test-email')
export class TestEmailSendController {
  constructor(private readonly testEmailSendService: TestEmailSendService) {}

  @Post()
  send(@Param('jobId') jobId: string, @Body() dto: SendTestEmailDto) {
    return this.testEmailSendService.send(jobId, dto.recipient);
  }
}
