import { ProjectMember, User } from '@prisma/client';

export type ProjectMemberUser = ProjectMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
};
