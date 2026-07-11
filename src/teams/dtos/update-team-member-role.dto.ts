import { TeamRole } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTeamMemberRoleDto {
  @IsEnum(TeamRole)
  @IsNotEmpty()
  role: TeamRole;
}
