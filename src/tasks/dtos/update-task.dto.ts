import { Priority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTaskDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  // Pass an ISO date string to set/change it, or `null` to clear it.
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value)
      ? (value as unknown[]).map((tag: unknown): unknown =>
          typeof tag === 'string' ? tag.trim().toLowerCase() : tag,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @IsOptional()
  tags?: string[];

  // Pass a userId to (re)assign, or `null` to unassign.
  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  // Pass a taskId to nest under a parent, or `null` to detach.
  @IsUUID()
  @IsOptional()
  parentTaskId?: string;
}
