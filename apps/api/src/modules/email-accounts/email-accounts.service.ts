import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  CredentialEncryptionError,
  encryptCredential,
  readEncryptionKey,
} from './credential-encryption.js';
import type { CreateEmailAccountDto } from './dto/create-email-account.dto.js';
import type { UpdateEmailAccountDto } from './dto/update-email-account.dto.js';
import {
  toEmailAccountResponse,
  type EmailAccountResponse,
  type EmailAccountRow,
} from './email-accounts.mapper.js';

/** Columns written when an account is created. */
export type EmailAccountCreateData = {
  name: string;
  senderName: string;
  emailAddress: string;
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: EmailAccountRow['smtpSecurity'];
  smtpUsername: string;
  smtpPasswordEncrypted: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: EmailAccountRow['imapSecurity'];
  imapUsername: string;
  imapPasswordEncrypted: string;
};

/** Changed columns of one update; an omitted column keeps its stored value. */
export type EmailAccountUpdateData = {
  name?: string;
  senderName?: string;
  emailAddress?: string;
  enabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: EmailAccountRow['smtpSecurity'];
  smtpUsername?: string;
  smtpPasswordEncrypted?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecurity?: EmailAccountRow['imapSecurity'];
  imapUsername?: string;
  imapPasswordEncrypted?: string;
};

@Injectable()
export class EmailAccountsService {
  private readonly logger = new Logger(EmailAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<EmailAccountResponse[]> {
    const rows = await this.prisma.emailAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(toEmailAccountResponse);
  }

  async findOne(id: string): Promise<EmailAccountResponse> {
    const row = await this.findRow(id);

    return toEmailAccountResponse(row);
  }

  /** Encrypts both credentials before the row is written. */
  async create(dto: CreateEmailAccountDto): Promise<EmailAccountResponse> {
    const key = this.requireEncryptionKey();

    const row = await this.prisma.emailAccount.create({
      data: {
        name: dto.name,
        senderName: dto.senderName,
        emailAddress: dto.emailAddress,
        enabled: dto.enabled ?? true,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpSecurity: dto.smtpSecurity,
        smtpUsername: dto.smtpUsername,
        smtpPasswordEncrypted: encryptCredential(dto.smtpPassword, key),
        imapHost: dto.imapHost,
        imapPort: dto.imapPort,
        imapSecurity: dto.imapSecurity,
        imapUsername: dto.imapUsername,
        imapPasswordEncrypted: encryptCredential(dto.imapPassword, key),
      },
    });

    return toEmailAccountResponse(row);
  }

  /**
   * Partial update. Password columns appear in the write only when a new
   * password was supplied, so editing settings retains the stored credentials.
   */
  async update(
    id: string,
    dto: UpdateEmailAccountDto,
  ): Promise<EmailAccountResponse> {
    const existing = await this.findRow(id);
    const data: EmailAccountUpdateData = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.senderName !== undefined) {
      data.senderName = dto.senderName;
    }

    if (dto.emailAddress !== undefined) {
      data.emailAddress = dto.emailAddress;
    }

    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled;
    }

    if (dto.smtpHost !== undefined) {
      data.smtpHost = dto.smtpHost;
    }

    if (dto.smtpPort !== undefined) {
      data.smtpPort = dto.smtpPort;
    }

    if (dto.smtpSecurity !== undefined) {
      data.smtpSecurity = dto.smtpSecurity;
    }

    if (dto.smtpUsername !== undefined) {
      data.smtpUsername = dto.smtpUsername;
    }

    if (dto.smtpPassword !== undefined) {
      data.smtpPasswordEncrypted = encryptCredential(
        dto.smtpPassword,
        this.requireEncryptionKey(),
      );
    }

    if (dto.imapHost !== undefined) {
      data.imapHost = dto.imapHost;
    }

    if (dto.imapPort !== undefined) {
      data.imapPort = dto.imapPort;
    }

    if (dto.imapSecurity !== undefined) {
      data.imapSecurity = dto.imapSecurity;
    }

    if (dto.imapUsername !== undefined) {
      data.imapUsername = dto.imapUsername;
    }

    if (dto.imapPassword !== undefined) {
      data.imapPasswordEncrypted = encryptCredential(
        dto.imapPassword,
        this.requireEncryptionKey(),
      );
    }

    if (Object.keys(data).length === 0) {
      return toEmailAccountResponse(existing);
    }

    const row = await this.prisma.emailAccount.update({ where: { id }, data });

    return toEmailAccountResponse(row);
  }

  private async findRow(id: string): Promise<EmailAccountRow> {
    const row = await this.prisma.emailAccount.findUnique({ where: { id } });

    if (row === null) {
      throw new NotFoundException(`Email account ${id} not found`);
    }

    return row;
  }

  /**
   * Validates the encryption configuration before it is used. A missing or
   * invalid key is a server misconfiguration: the request fails safely and the
   * response names no key material, password or stored ciphertext.
   */
  private requireEncryptionKey(): Buffer {
    try {
      return readEncryptionKey();
    } catch (error) {
      const reason =
        error instanceof CredentialEncryptionError
          ? error.message
          : 'the encryption key could not be read.';

      this.logger.error(
        `Email-account credential encryption is unavailable: ${reason}`,
      );

      throw new InternalServerErrorException(
        'Email account credentials cannot be processed because credential encryption is not configured.',
      );
    }
  }
}
