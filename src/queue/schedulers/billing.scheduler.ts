import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailQueueService } from '../email-queue.service';
import { RedisService } from 'src/redis/redis.service';
import { OrgRole, Plan } from '@prisma/client';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class BillingScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  // 09:00 UTC - warn owners 7 days before expiry
  @Cron('0 9 * * *', { timeZone: 'UTC' })
  async warnExpiringSubscriptions(): Promise<void> {
    const locked = await this.redis.acquireCronLock('subscription-expiry-warnings', 3600);
    if (!locked) return;

    this.logger.log('Running subscription expiry warning cron');

    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const orgs = await this.prisma.organization.findMany({
        where: {
          plan: { not: Plan.FREE },
          deletedAt: null,
          // Expiring within the next 7 days but hasn't expired yet
          stripeCurrentPeriodEnd: { lte: sevenDaysFromNow, gte: now },
        },
        select: {
          id: true,
          name: true,
          plan: true,
          stripeCurrentPeriodEnd: true,
          members: {
            where: { role: OrgRole.OWNER },
            select: {
              user: { select: { email: true, name: true, notifPreferences: true } },
            },
            take: 1, // one owner per org
          },
        },
      });

      let warned = 0;

      for (const org of orgs) {
        const owner = org.members[0]?.user;
        if (!owner) {
          this.logger.warn(`Org ${org.id} has no owner — cannot send expiry warning`);
          continue;
        }

        await this.emailQueue.addSubscriptionExpiryWarning({
          email: owner.email,
          orgName: org.name,
          expiresAt: org.stripeCurrentPeriodEnd!,
        });

        warned++;
      }

      this.logger.log(`Subscription expiry warnings: ${warned} sent`);
    } catch (err: unknown) {
      this.logger.error(
        'Subscription expiry warning cron failed',
        err instanceof Error ? err : undefined,
        BillingScheduler.name,
      );
    }
  }

  @Cron('0 * * * *', { timeZone: 'UTC' }) // top of every hour
  async downgradeExpiredSubscriptions(): Promise<void> {
    const locked = await this.redis.acquireCronLock('subscription-downgrade', 3500); // 58 min
    if (!locked) return;

    try {
      const now = new Date();

      const result = await this.prisma.organization.updateMany({
        where: {
          plan: { not: Plan.FREE },
          stripeCurrentPeriodEnd: { lt: now }, // period has already ended
          deletedAt: null,
        },
        data: { plan: Plan.FREE },
      });

      if (result.count > 0) {
        this.logger.warn(`Downgraded ${result.count} org(s) to FREE (missed webhook safety-net)`);
      }
    } catch (err: unknown) {
      this.logger.error(
        'Subscription downgrade cron failed',
        err instanceof Error ? err : undefined,
        BillingScheduler.name,
      );
    }
  }
}
