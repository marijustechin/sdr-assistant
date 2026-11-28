import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Body of `POST /research/:jobId/communication/test-email`. */
export class SendTestEmailDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  @IsEmail({}, { message: 'recipient must be an email address' })
  recipient!: string;
}
