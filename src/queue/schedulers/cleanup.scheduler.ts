import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoggerService } from 'src/logger/logger.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class CleanupScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  // 02:00 UTC - purge tasks soft-deleted > 30 days ago
  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async purgeOldSoftDeletedTasks(): Promise<void> {
    const locked = await this.redis.acquireCronLock('cleanup-deleted-tasks', 3600);
    if (!locked) return;

    this.logger.log('Running soft-delete cleanup cron');

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Delete in batches to avoid long-running transactions locking the table
      let totalPurged = 0;
      const batchSize = 500;

      while (true) {
        // Find a batch of IDs first
        const batch = await this.prisma.task.findMany({
          where: { deletedAt: { not: null, lte: thirtyDaysAgo } },
          select: { id: true },
          take: batchSize,
        });

        if (batch.length === 0) break;

        const ids = batch.map((t) => t.id);

        const result = await this.prisma.task.deleteMany({
          where: { id: { in: ids } },
        });

        totalPurged += result.count;

        if (batch.length < batchSize) break; // last batch
      }

      if (totalPurged > 0) {
        this.logger.log(`Purged ${totalPurged} task(s) soft-deleted more than 30 days ago`);
      } else {
        this.logger.debug('No tasks to purge');
      }
    } catch (err: unknown) {
      this.logger.error(
        'Cleanup cron failed',
        err instanceof Error ? err : undefined,
        CleanupScheduler.name,
      );
    }
  }

  // 02:30 UTC - purge expired OrgInvitations
  @Cron('30 2 * * *', { timeZone: 'UTC' })
  async purgeExpiredInvitations(): Promise<void> {
    const locked = await this.redis.acquireCronLock('cleanup-expired-invitations', 3600);
    if (!locked) return;

    try {
      const result = await this.prisma.orgInvitation.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      if (result.count > 0) {
        this.logger.log(`Purged ${result.count} expired org invitation(s)`);
      }
    } catch (err: unknown) {
      this.logger.error(
        'Invitation cleanup cron failed',
        err instanceof Error ? err : undefined,
        CleanupScheduler.name,
      );
    }
  }
}
