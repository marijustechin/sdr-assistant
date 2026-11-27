import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body of `PATCH /research/:jobId/communication/initial-email`.
 *
 * Both values are required plain text. The service trims them, rejects a
 * whitespace-only value and applies the same length limits. No personalization
 * variable, HTML or attachment is accepted.
 */
export class UpdateResearchInitialEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  body!: string;
}
