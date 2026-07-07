import { ProjectStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus)
  @IsNotEmpty()
  status: ProjectStatus;
}
