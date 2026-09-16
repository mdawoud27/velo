import { PrismaService } from 'src/prisma/prisma.service';
import bcrypt from 'bcryptjs';
import { SystemRole, User } from '@prisma/client';

export async function createUser(
  prisma: PrismaService,
  overrides: Partial<Parameters<PrismaService['user']['create']>[0]['data']> = {},
): Promise<User> {
  const defaultPassword = await bcrypt.hash('Password123!', 1);

  return prisma.user.create({
    data: {
      name: 'Test User',
      email: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@example.com`,
      password: defaultPassword,
      isEmailVerified: true,
      systemRole: SystemRole.USER,
      ...overrides,
    },
  });
}
