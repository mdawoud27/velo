import { Prisma } from '@prisma/client';

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true; avatarUrl: true } };
  };
}>;

export interface KanbanBoard {
  TODO: TaskWithRelations[];
  IN_PROGRESS: TaskWithRelations[];
  IN_REVIEW: TaskWithRelations[];
  DONE: TaskWithRelations[];
}
