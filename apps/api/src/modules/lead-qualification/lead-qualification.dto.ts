import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartLeadQualificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
