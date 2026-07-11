import { Priority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from 'src/common/dtos';

export enum TagsMatchMode {
  ANY = 'any', // hasSome
  ALL = 'all', // hasEvery
}

export class FilterTasksDto extends PaginationDto {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @IsUUID()
  @IsOptional()
  creatorId?: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @Transform(({ value }: { value: unknown }): unknown => {
    if (Array.isArray(value)) return value.map((tag) => String(tag).trim().toLowerCase());
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsOptional()
  @IsEnum(TagsMatchMode)
  tagsMode?: TagsMatchMode;

  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  @IsOptional()
  @IsBoolean()
  untaggedOnly?: boolean;

  @IsDateString()
  @IsOptional()
  dueBefore?: string;

  @IsDateString()
  @IsOptional()
  dueAfter?: string;

  // Filter to the direct subtasks of this task.
  @IsUUID()
  @IsOptional()
  parentTaskId?: string;

  // When true (and parentTaskId isn't set), hides subtasks and returns only top-level tasks.
  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  @IsBoolean()
  @IsOptional()
  topLevelOnly?: boolean;
}
