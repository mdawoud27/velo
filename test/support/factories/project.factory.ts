import { PrismaService } from 'src/prisma/prisma.service';
import { Project, ProjectStatus } from '@prisma/client';

export async function createProject(
  prisma: PrismaService,
  teamId: string,
  actorId?: string,
  overrides: Partial<Parameters<PrismaService['project']['create']>[0]['data']> = {},
): Promise<Project> {
  return prisma.project.create({
    data: {
      name: `Project-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      teamId,
      status: ProjectStatus.ACTIVE,
      ...overrides,
      ...(actorId
        ? {
            members: {
              create: {
                userId: actorId,
              },
            },
          }
        : {}),
    },
  });
}
