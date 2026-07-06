import { TeamMember, User, TeamRole } from '@prisma/client';

type TeamMemberUser = TeamMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
};

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
