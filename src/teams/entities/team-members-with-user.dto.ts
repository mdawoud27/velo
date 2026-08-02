import { TeamRole } from '@prisma/client';
import { TeamMemberUser } from '../types';

export class TeamMemberWithUserEntity {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;

  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };

  constructor(member: TeamMemberUser) {
    Object.assign(this, member);
  }
}
