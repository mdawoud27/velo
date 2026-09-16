import { PrismaService } from 'src/prisma/prisma.service';
import { Priority, Task, TaskStatus } from '@prisma/client';

export async function createTask(
  prisma: PrismaService,
  projectId: string,
  creatorId: string,
  overrides: Partial<Parameters<PrismaService['task']['create']>[0]['data']> = {},
): Promise<Task> {
  return prisma.task.create({
    data: {
      title: `Task-${Date.now()}`,
      projectId,
      creatorId,
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      ...overrides,
    },
  });
}
