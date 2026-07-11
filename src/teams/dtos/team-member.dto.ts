import { TeamRole } from '@prisma/client';

export class TeamMemberDto {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
}
