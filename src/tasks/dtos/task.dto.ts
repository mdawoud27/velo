export class TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: Date | null;
  tags: string[];
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  parentTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
