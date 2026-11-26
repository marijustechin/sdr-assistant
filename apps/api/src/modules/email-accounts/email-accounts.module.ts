import { Module } from '@nestjs/common';

import { EmailAccountsController } from './email-accounts.controller.js';
import { EmailAccountsService } from './email-accounts.service.js';

@Module({
  controllers: [EmailAccountsController],
  providers: [EmailAccountsService],
})
export class EmailAccountsModule {}
