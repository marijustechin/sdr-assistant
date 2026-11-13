import { Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreateProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => item !== '')
      : value,
  )
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @ArrayMaxSize(50)
  possibleSearchTerms?: string[]
}
