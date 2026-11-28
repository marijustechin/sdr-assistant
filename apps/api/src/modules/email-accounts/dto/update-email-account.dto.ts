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
 * An absent signature field is left unchanged; a blank one clears it. `null` is
 * accepted as the explicit "not configured" value.
 */
const optionalSignatureValue = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * An absent, empty or whitespace-only password means "keep the stored
 * credential". A non-empty value replaces it. Passwords are not trimmed: a
 * leading or trailing space can be part of a real credential.
 */
const optionalPassword = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * Body of `PATCH /email-accounts/:id`. Every field is optional; a field that is
 * absent is left unchanged in the database. `enabled` is how the UI enables and
 * disables an account.
 */
export class UpdateEmailAccountDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  senderName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  @IsEmail({}, { message: 'emailAddress must be an email address' })
  emailAddress?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsIn([...EMAIL_SECURITY_MODES])
  smtpSecurity?: EmailSecurityMode;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  smtpUsername?: string;

  @Transform(optionalPassword)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  smtpPassword?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  imapHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @IsOptional()
  @IsIn([...EMAIL_SECURITY_MODES])
  imapSecurity?: EmailSecurityMode;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  imapUsername?: string;

  @Transform(optionalPassword)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  imapPassword?: string;

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
