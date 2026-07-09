import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class TaskTagsDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value) ? (value as string[]).map((tag) => tag.trim().toLowerCase()) : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[];
}
