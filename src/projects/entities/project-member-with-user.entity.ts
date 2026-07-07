import { ProjectMember, User } from '@prisma/client';

type ProjectMemberUser = ProjectMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
};

export class ProjectMemberWithUserEntity {
  id: string;
  userId: string;
  projectId: string;

  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };

  constructor(member: ProjectMemberUser) {
    Object.assign(this, member);
  }
}
