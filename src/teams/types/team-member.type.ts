import { TeamMember, User } from '@prisma/client';

export type TeamMemberUser = TeamMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
};
