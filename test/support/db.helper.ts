import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { assertSafeTestDatabaseUrl } from './database-safety';

export async function resetDatabase(prisma: PrismaService, redis?: RedisService): Promise<void> {
  assertSafeTestDatabaseUrl();

  await prisma.$transaction(
    [
      prisma.attachment.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.taskWatcher.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.stripeEvent.deleteMany(),
      prisma.task.deleteMany(),
      prisma.projectMember.deleteMany(),
      prisma.project.deleteMany(),
      prisma.teamMember.deleteMany(),
      prisma.team.deleteMany(),
      prisma.orgInvitation.deleteMany(),
      prisma.orgMember.deleteMany(),
      prisma.organization.deleteMany(),
      prisma.user.deleteMany(),
    ],
    { timeout: 30000 },
  );

  if (redis) {
    try {
      await redis.getClient().flushdb();
    } catch {
      // Ignore redis flush error if client disconnected
    }
  }
}
