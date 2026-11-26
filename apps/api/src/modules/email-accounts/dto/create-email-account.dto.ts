import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  EMAIL_SECURITY_MODES,
  type EmailSecurityMode,
} from '../email-accounts.constants.js';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Body of `POST /email-accounts`.
 *
 * SMTP and IMAP are independent groups: each has its own host, port, security,
 * username and password. Both passwords are required when an account is
 * created. `enabled` defaults to true in the database.
 */
export class CreateEmailAccountDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  senderName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  @IsEmail({}, { message: 'emailAddress must be an email address' })
  emailAddress!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsIn([...EMAIL_SECURITY_MODES])
  smtpSecurity!: EmailSecurityMode;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  smtpUsername!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  smtpPassword!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  imapHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort!: number;

  @IsIn([...EMAIL_SECURITY_MODES])
  imapSecurity!: EmailSecurityMode;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  imapUsername!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  imapPassword!: string;
}
