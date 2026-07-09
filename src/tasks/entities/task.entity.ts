import { Priority, Task, TaskStatus } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class TaskEntity implements Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  tags: string[];
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  parentTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;

  @Exclude() deletedAt: Date | null;

  constructor(task: Task) {
    Object.assign(this, task);
  }
}
