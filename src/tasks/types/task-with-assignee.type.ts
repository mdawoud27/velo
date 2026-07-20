import { Prisma } from '@prisma/client';

export const taskWithAssigneeSelect = {
  id: true,
  title: true,
  description: true,
  projectId: true,
  status: true,
  priority: true,
  dueDate: true,
  assigneeId: true,
  assignee: {
    select: {
      id: true,
      email: true,
      name: true,
      notifPreferences: true,
    },
  },
} satisfies Prisma.TaskSelect;
export type TaskWithAssignee = Prisma.TaskGetPayload<{
  select: typeof taskWithAssigneeSelect;
}>;
