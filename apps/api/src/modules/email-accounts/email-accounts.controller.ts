import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CreateEmailAccountDto } from './dto/create-email-account.dto.js';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto.js';
import { EmailConnectionVerificationService } from './email-connection-verification.service.js';
import { EmailAccountsService } from './email-accounts.service.js';

/**
 * Email-account configuration and saved-configuration connection tests.
 *
 * The test endpoints accept no body: they only verify the stored SMTP or IMAP
 * settings. No endpoint sends a message, opens a mailbox or returns a stored
 * credential.
 */
@Controller('email-accounts')
export class EmailAccountsController {
  constructor(
    private readonly emailAccountsService: EmailAccountsService,
    private readonly connectionVerificationService: EmailConnectionVerificationService,
  ) {}

  @Get()
  findAll() {
    return this.emailAccountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emailAccountsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmailAccountDto) {
    return this.emailAccountsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmailAccountDto) {
    return this.emailAccountsService.update(id, dto);
  }

  @Post(':id/test-smtp')
  testSmtp(@Param('id') id: string) {
    return this.connectionVerificationService.verify(id, 'SMTP');
  }

  @Post(':id/test-imap')
  testImap(@Param('id') id: string) {
    return this.connectionVerificationService.verify(id, 'IMAP');
  }
}
