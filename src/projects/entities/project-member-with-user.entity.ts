import { ProjectMemberUser } from '../types';

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
