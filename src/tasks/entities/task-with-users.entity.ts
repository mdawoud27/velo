import { Priority, Task, TaskStatus, User } from '@prisma/client';

type TaskUserSummary = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;

type TaskWithUsers = Task & {
  assignee: TaskUserSummary | null;
  creator: TaskUserSummary;
};

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

  assignee: TaskUserSummary | null;
  creator: TaskUserSummary;

  constructor(task: TaskWithUsers) {
    Object.assign(this, task);
  }
}
