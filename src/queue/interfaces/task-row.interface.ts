import { Priority, TaskStatus } from '@prisma/client';

export interface TaskRow {
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeName: string;
  dueDate: string;
  tags: string;
  commentsCount: number;
  createdAt: string;
}
