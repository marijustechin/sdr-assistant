import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CreateEmailAccountDto } from './dto/create-email-account.dto.js';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto.js';
import { EmailAccountsService } from './email-accounts.service.js';

/**
 * Email-account configuration only. No endpoint connects to a mail server,
 * sends a message or returns a stored credential.
 */
@Controller('email-accounts')
export class EmailAccountsController {
  constructor(private readonly emailAccountsService: EmailAccountsService) {}

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
}
