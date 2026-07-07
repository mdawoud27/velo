import { ProjectMember } from '@prisma/client';

export class ProjectMemberEntity implements ProjectMember {
  id: string;
  userId: string;
  projectId: string;

  constructor(member: ProjectMember) {
    Object.assign(this, member);
  }
}
