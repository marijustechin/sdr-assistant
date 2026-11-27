import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Body of `PATCH /research/:jobId/communication/email-account`.
 *
 * `null` deliberately removes the assignment, so it must be accepted as a
 * value rather than treated as an absent field. Any other value must be a
 * non-empty account id; the service validates that the account exists and is
 * enabled.
 */
export class UpdateResearchEmailAccountDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  emailAccountId!: string | null;
}
