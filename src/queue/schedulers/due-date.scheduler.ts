import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailQueueService } from '../services/email-queue.service';
import { RedisService } from 'src/redis/redis.service';
import { TaskStatus } from '@prisma/client';
import { ASSIGNEE_WITH_PREFS_SELECT } from 'src/tasks/constants';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class DueDateScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'UTC' })
  async sendDueDateReminders(): Promise<void> {
    try {
      // Multi-instance guard: only one instance processes this per day
      const locked = await this.redis.acquireCronLock('due-date-reminders', 3600);
      if (!locked) {
        this.logger.debug('Due-date reminders already running on another instance — skipping');
        return;
      }

      this.logger.log('Running due-date reminder cron');

      // Window: tasks due in the NEXT 24 hours (not already overdue)
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const tasks = await this.prisma.task.findMany({
        where: {
          dueDate: { gte: now, lte: tomorrow },
          status: { notIn: [TaskStatus.DONE] },
          deletedAt: null,
          assigneeId: { not: null },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          projectId: true,
          // notifPreferences from assignee — needed for gated email
          assignee: { select: ASSIGNEE_WITH_PREFS_SELECT },
          project: { select: { id: true, name: true } },
        },
      });

      if (tasks.length === 0) {
        this.logger.log('No due-date reminders to send today');
        return;
      }

      // Send individually so one failure doesn't block others
      let sent = 0;
      let skipped = 0;

      for (const task of tasks) {
        if (!task.assignee) continue;

        try {
          await this.emailQueue.addDueReminderEmail(task.assignee, {
            taskTitle: task.title,
            dueDate: task.dueDate!.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }),
            taskUrl: `${process.env.FRONTEND_URL}/tasks/${task.id}`,
          });
          sent++;
        } catch {
          skipped++;
          this.logger.warn(`Failed to enqueue due-date reminder for task ${task.id}`);
        }
      }

      this.logger.log(`Due-date reminders: ${sent} sent, ${skipped} skipped`);
    } catch (err: unknown) {
      this.logger.error(
        'Due-date reminder cron failed',
        err instanceof Error ? err : undefined,
        DueDateScheduler.name,
      );
    }
  }

  // Testable: call directly without waiting for cron fire
  async runNow(): Promise<void> {
    return this.sendDueDateReminders();
  }
}
