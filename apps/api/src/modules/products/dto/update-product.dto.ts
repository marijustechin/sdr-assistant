import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string
}
