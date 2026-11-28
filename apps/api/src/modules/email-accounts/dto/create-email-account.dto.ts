import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
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
 * Signature fields are optional. A blank value is sent as `null` so the field
 * is stored as "not configured"; both forms clear the stored value.
 */
const optionalSignatureValue = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

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

  @Transform(optionalSignatureValue)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signatureName?: string | null;

  @Transform(optionalSignatureValue)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signatureCompany?: string | null;

  @Transform(optionalSignatureValue)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  signaturePhone?: string | null;

  @Transform(optionalSignatureValue)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { message: 'signatureWebsite must be an http:// or https:// link' },
  )
  signatureWebsite?: string | null;

  @Transform(optionalSignatureValue)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { message: 'signatureWhatsapp must be an http:// or https:// link' },
  )
  signatureWhatsapp?: string | null;

  @Transform(optionalSignatureValue)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  signatureText?: string | null;
}
