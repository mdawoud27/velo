import { Task } from '@prisma/client';
import { TaskUserSummary } from './task-summary.type';

export type TaskWithUsers = Task & {
  assignee: TaskUserSummary | null;
  creator: TaskUserSummary;
};
