import { ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class TaskTagsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[];
}
