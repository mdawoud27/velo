import { PrismaService } from 'src/prisma/prisma.service';
import { Organization, OrgRole, Plan } from '@prisma/client';

export async function createOrganization(
  prisma: PrismaService,
  ownerId: string,
  overrides: Partial<Parameters<PrismaService['organization']['create']>[0]['data']> = {},
): Promise<Organization> {
  return prisma.organization.create({
    data: {
      name: `Org-${Date.now()}`,
      plan: Plan.FREE,
      ...overrides,
      members: {
        create: {
          userId: ownerId,
          role: OrgRole.OWNER,
        },
      },
    },
  });
}
