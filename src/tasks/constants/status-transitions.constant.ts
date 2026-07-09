import { TaskStatus } from '@prisma/client';

export const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: [TaskStatus.IN_PROGRESS],
  IN_PROGRESS: [TaskStatus.TODO, TaskStatus.IN_REVIEW],
  IN_REVIEW: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  DONE: [TaskStatus.IN_PROGRESS],
};
