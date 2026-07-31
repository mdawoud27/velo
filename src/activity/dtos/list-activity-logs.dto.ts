import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dtos';

export class ListActivityLogsDto extends PaginationDto {
  @IsUUID()
  orgId: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
