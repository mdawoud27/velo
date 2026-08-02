import { Priority, TaskStatus } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { TaskUserSummary, TaskWithUsers } from '../types';

export class TaskWithUsersEntity {
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
  assignee: TaskUserSummary | null;
  creator: TaskUserSummary;
  constructor(task: TaskWithUsers) {
    Object.assign(this, task);
  }
}
