import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @Transform(({ value }: { value: unknown }): unknown => {
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsNotEmpty()
  name: string;

  @Transform(({ value }: { value: unknown }): unknown => {
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;
}
