import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { OrgRole, Plan } from '@prisma/client';
import { ExportQueueService } from '../services';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class ScheduledExportScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly exportQueue: ExportQueueService,
    private readonly logger: LoggerService,
  ) {}

  // Every Monday 07:00 UTC - weekly tasks report
  @Cron('0 7 * * 1', { timeZone: 'UTC' })
  async scheduleWeeklyTasksReports(): Promise<void> {
    const locked = await this.redis.acquireCronLock('weekly-tasks-reports', 3600);
    if (!locked) return;

    this.logger.log('Scheduling weekly tasks reports');

    try {
      const orgs = await this.getActiveOrgsWithOwners();

      let queued = 0;
      for (const org of orgs) {
        await this.exportQueue.addWeeklyTasksReport({
          orgId: org.id,
          ownerEmail: org.owner.email,
          ownerName: org.owner.name,
          orgName: org.name,
        });
        queued++;
      }

      this.logger.log(`Weekly tasks reports: ${queued} jobs queued`);
    } catch (err: unknown) {
      this.logger.error(
        'Failed to schedule weekly tasks reports',
        err instanceof Error ? err : undefined,
        ScheduledExportScheduler.name,
      );
    }
  }

  //  1st and 15th of each month at 07:30 UTC - bi-weekly projects report
  @Cron('30 7 1,15 * *', { timeZone: 'UTC' })
  async scheduleBiweeklyProjectsReports(): Promise<void> {
    const locked = await this.redis.acquireCronLock('biweekly-projects-reports', 3600);
    if (!locked) return;

    this.logger.log('Scheduling bi-weekly projects reports');

    try {
      const orgs = await this.getActiveOrgsWithOwners();

      let queued = 0;
      for (const org of orgs) {
        await this.exportQueue.addBiweeklyProjectsReport({
          orgId: org.id,
          ownerEmail: org.owner.email,
          ownerName: org.owner.name,
          orgName: org.name,
        });
        queued++;
      }

      this.logger.log(`Bi-weekly project reports: ${queued} jobs queued`);
    } catch (err: unknown) {
      this.logger.error(
        'Failed to schedule bi-weekly projects reports',
        err instanceof Error ? err : undefined,
        ScheduledExportScheduler.name,
      );
    }
  }

  // 1st of each month at 08:00 UTC - monthly org report
  @Cron('0 8 1 * *', { timeZone: 'UTC' })
  async scheduleMonthlyOrgReports(): Promise<void> {
    const locked = await this.redis.acquireCronLock('monthly-org-reports', 3600);
    if (!locked) return;

    this.logger.log('Scheduling monthly org reports');

    try {
      // Monthly report: only PRO and BUSINESS orgs - free orgs don't get analytics
      const orgs = await this.getActiveOrgsWithOwners(true);

      let queued = 0;
      for (const org of orgs) {
        await this.exportQueue.addMonthlyOrgReport({
          orgId: org.id,
          ownerEmail: org.owner.email,
          ownerName: org.owner.name,
          orgName: org.name,
        });
        queued++;
      }

      this.logger.log(`Monthly org reports: ${queued} jobs queued`);
    } catch (err: unknown) {
      this.logger.error(
        'Failed to schedule monthly org reports',
        err instanceof Error ? err : undefined,
        ScheduledExportScheduler.name,
      );
    }
  }

  private async getActiveOrgsWithOwners(paidOnly = false) {
    const orgs = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(paidOnly && { plan: { not: Plan.FREE } }),
      },
      select: {
        id: true,
        name: true,
        plan: true,
        members: {
          where: { role: OrgRole.OWNER },
          select: { user: { select: { email: true, name: true } } },
          take: 1,
        },
      },
    });

    return orgs
      .filter((org) => org.members[0]?.user) // skip orgs with no owner
      .map((org) => ({
        id: org.id,
        name: org.name,
        owner: {
          email: org.members[0].user.email,
          name: org.members[0].user.name,
        },
      }));
  }
}
