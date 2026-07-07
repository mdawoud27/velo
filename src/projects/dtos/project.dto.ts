export class ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  deadline: Date | null;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}
