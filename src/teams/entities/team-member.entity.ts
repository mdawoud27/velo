import { TeamMember, TeamRole } from '@prisma/client';

export class TeamMemberEntity implements TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;

  constructor(member: TeamMember) {
    Object.assign(this, member);
  }
}
