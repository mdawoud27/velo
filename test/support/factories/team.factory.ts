import { PrismaService } from 'src/prisma/prisma.service';
import { Team, TeamRole } from '@prisma/client';

export async function createTeam(
  prisma: PrismaService,
  orgId: string,
  actorId: string,
  overrides: Partial<Parameters<PrismaService['team']['create']>[0]['data']> = {},
): Promise<Team> {
  return prisma.team.create({
    data: {
      name: `Team-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orgId,
      ...overrides,
      members: {
        create: {
          userId: actorId,
          role: TeamRole.LEAD,
        },
      },
    },
  });
}
