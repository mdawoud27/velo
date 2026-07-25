import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Plan, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { ActivityService } from 'src/activity/activity.service';
import { LoggerService } from 'src/logger/logger.service';
import { ResourceNotFoundException } from 'src/common/exceptions';
import { EMAIL_QUEUE, EXPORT_QUEUE } from 'src/queue/constants';
import { buildPaginationMeta } from 'src/common/utils';
import { PaginationDto } from 'src/common/dtos';
import { EmailJobData, ExportJobData } from 'src/queue/interfaces';

const KNOWN_QUEUES: Record<string, string> = {
  [EMAIL_QUEUE]: EMAIL_QUEUE,
  [EXPORT_QUEUE]: EXPORT_QUEUE,
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly activity: ActivityService,
    private readonly logger: LoggerService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
    @InjectQueue(EXPORT_QUEUE) private readonly exportQueue: Queue<ExportJobData>,
  ) {}

  // Platform stats
  async getPlatformStats() {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalOrgs,
      totalTasks,
      activeProjects,
      planDistribution,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { bannedAt: null, deletedAt: null } }),
      this.prisma.user.count({ where: { bannedAt: { not: null } } }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.task.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.organization.groupBy({
        by: ['plan'],
        _count: { _all: true },
        where: { deletedAt: null },
        orderBy: { plan: 'asc' },
      }),
      // Last 7 days activity volume
      this.prisma.activityLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, banned: bannedUsers },
      orgs: {
        total: totalOrgs,
        byPlan: Object.fromEntries(planDistribution.map((p) => [p.plan, p._count._all])) as Record<
          Plan,
          number
        >,
      },
      projects: { active: activeProjects },
      tasks: { total: totalTasks },
      activity: { last7Days: recentActivity },
    };
  }

  // User management
  async listUsers(dto: PaginationDto & { search?: string; banned?: boolean }) {
    const where: Prisma.UserWhereInput = {
      // deletedAt: null,
      ...(dto.search && {
        OR: [
          { email: { contains: dto.search, mode: 'insensitive' } },
          { name: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.banned !== undefined && {
        bannedAt: dto.banned ? { not: null } : null,
      }),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          bannedAt: true,
          deletedAt: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: users,
    };
  }

  async banUser(userId: string, actorId: string, reason?: string): Promise<void> {
    if (userId === actorId) {
      throw new ForbiddenException('You cannot ban yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new ResourceNotFoundException('User', userId);
    if (target.deletedAt) throw new ForbiddenException('User is deleted');
    if (target.bannedAt) throw new ForbiddenException('User is already banned');
    if (target.systemRole === SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot ban a super admin');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date() },
    });

    await Promise.all([
      this.redis.setex(`user-ban:${userId}`, 'banned', 300),
      this.redis.del(`refresh:${userId}`),
    ]);

    this.activity.log({
      action: 'admin.user.banned',
      entityType: 'User',
      entityId: userId,
      actorId,
      metadata: { reason: reason ?? 'No reason provided' },
    });

    this.logger.log(`Admin ${actorId} banned user ${userId}. Reason: ${reason ?? 'none'}`);
  }

  async unbanUser(userId: string, actorId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new ResourceNotFoundException('User', userId);
    if (target.deletedAt) throw new ForbiddenException('User is deleted');
    if (!target.bannedAt) throw new ForbiddenException('User is not banned');

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null },
    });

    // Remove the Redis ban cache so they can use their next valid token immediately
    await this.redis.del(`user-ban:${userId}`);

    this.activity.log({
      action: 'admin.user.unbanned',
      entityType: 'User',
      entityId: userId,
      actorId,
    });
  }

  async promoteToAdmin(userId: string, actorId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null, bannedAt: null },
    });
    if (!target) throw new ResourceNotFoundException('User', userId);
    if (target.systemRole === SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException('User is already a super admin');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { systemRole: SystemRole.SUPER_ADMIN },
    });

    this.activity.log({
      action: 'admin.user.promoted',
      entityType: 'User',
      entityId: userId,
      actorId,
      metadata: { newRole: SystemRole.SUPER_ADMIN },
    });
  }

  // Task management
  async restoreTask(taskId: string, actorId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: { not: null, gte: thirtyDaysAgo },
      },
    });

    if (!task) {
      throw new ResourceNotFoundException(
        'Deleted task (either not found or deleted more than 30 days ago)',
        taskId,
      );
    }

    const restored = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: null },
    });

    this.activity.log({
      action: 'admin.task.restored',
      entityType: 'Task',
      entityId: taskId,
      actorId,
      projectId: task.projectId,
      metadata: { originalDeletedAt: task.deletedAt },
    });

    return restored;
  }

  async listDeletedTasks(dto: PaginationDto) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: { deletedAt: { not: null, gte: thirtyDaysAgo } },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          projectId: true,
          project: { select: { name: true } },
          creator: { select: { id: true, name: true } },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.task.count({ where: { deletedAt: { not: null, gte: thirtyDaysAgo } } }),
    ]);

    return { meta: buildPaginationMeta(total, dto.page, dto.limit), data: tasks };
  }

  // Audit log
  async getAuditLogs(dto: PaginationDto & { actorId?: string; action?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(dto.actorId && { actorId: dto.actorId }),
      ...(dto.action && { action: { contains: dto.action, mode: 'insensitive' } }),
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { meta: buildPaginationMeta(total, dto.page, dto.limit), data: logs };
  }

  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed, jobCounts] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getJobCounts(),
    ]);

    return {
      queueName,
      counts: { waiting, active, completed, failed, delayed },
      jobCounts,
    };
  }

  async getFailedJobs(queueName: string, dto: PaginationDto) {
    const queue = this.getQueue(queueName);
    const start = (dto.page - 1) * dto.limit;
    const end = start + dto.limit - 1;

    const jobs = (await queue.getFailed(start, end)) as Job<EmailJobData | ExportJobData>[];
    const total = await queue.getFailedCount();

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })),
    };
  }

  async retryJob(queueName: string, jobId: string, actorId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) throw new ResourceNotFoundException('Job', jobId);

    const state = await job.getState();
    if (state !== 'failed') {
      throw new ForbiddenException(`Job is in '${state}' state — only failed jobs can be retried`);
    }

    await job.retry();

    this.activity.log({
      action: 'admin.queue.job.retried',
      entityType: 'QueueJob',
      entityId: jobId,
      actorId,
      metadata: { queueName, jobName: job.name },
    });
  }

  async deleteJob(queueName: string, jobId: string, actorId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) throw new ResourceNotFoundException('Job', jobId);

    const state = await job.getState();
    if (state === 'active') {
      throw new ForbiddenException('Cannot delete an active job — wait for it to complete');
    }

    await job.remove();

    this.activity.log({
      action: 'admin.queue.job.deleted',
      entityType: 'QueueJob',
      entityId: jobId,
      actorId,
      metadata: { queueName, jobName: job.name, previousState: state },
    });
  }

  // Organization management
  async overridePlan(orgId: string, plan: Plan, actorId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) throw new ResourceNotFoundException('Organization', orgId);

    const previousPlan = org.plan;

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { plan },
    });

    this.activity.log({
      action: 'admin.org.plan_overridden',
      entityType: 'Organization',
      entityId: orgId,
      actorId,
      orgId,
      metadata: { from: previousPlan, to: plan },
    });
  }

  // Queue management
  private getQueue(queueName: string): Queue<EmailJobData> | Queue<ExportJobData> {
    const validated = KNOWN_QUEUES[queueName];
    if (!validated) {
      throw new ResourceNotFoundException('Queue', queueName);
    }
    return queueName === EMAIL_QUEUE ? this.emailQueue : this.exportQueue;
  }
}
