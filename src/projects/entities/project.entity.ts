import { Project, ProjectStatus } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class ProjectEntity implements Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deadline: Date | null;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;

  @Exclude() deletedAt: Date | null;

  constructor(project: Project) {
    Object.assign(this, project);
  }
}
