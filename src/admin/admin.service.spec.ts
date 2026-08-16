import { ForbiddenException } from '@nestjs/common';
import { Plan, SystemRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { ResourceNotFoundException } from 'src/common/exceptions';

function makePrisma() {
  return {
    user: {
      count: jest.fn().mockResolvedValue(10),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      count: jest.fn().mockResolvedValue(5),
      groupBy: jest.fn().mockResolvedValue([{ plan: 'FREE', _count: { _all: 5 } }]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    team: { count: jest.fn().mockResolvedValue(3) },
    task: {
      count: jest.fn().mockResolvedValue(20),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    project: { count: jest.fn().mockResolvedValue(4) },
    activityLog: {
      count: jest.fn().mockResolvedValue(50),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
  } as any;
}

function makeRedis() {
  return {
    setex: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeActivity() {
  return { log: jest.fn() } as any;
}

function makeLogger() {
  return { log: jest.fn(), error: jest.fn() } as any;
}

function makeQueue() {
  return {
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(1),
    getCompletedCount: jest.fn().mockResolvedValue(10),
    getFailedCount: jest.fn().mockResolvedValue(2),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 1 }),
    getFailed: jest.fn().mockResolvedValue([]),
    getJob: jest.fn(),
  } as any;
}

describe('AdminService', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let activity: ReturnType<typeof makeActivity>;
  let emailQueue: ReturnType<typeof makeQueue>;
  let exportQueue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    activity = makeActivity();
    emailQueue = makeQueue();
    exportQueue = makeQueue();
    service = new AdminService(prisma, redis, activity, makeLogger(), emailQueue, exportQueue);
  });

  describe('getPlatformStats', () => {
    it('aggregates platform statistics', async () => {
      const stats = await service.getPlatformStats();
      expect(stats.users.total).toBe(10);
      expect(stats.orgs.total).toBe(5);
      expect(stats.teams.total).toBe(3);
      expect(stats.projects.active).toBe(4);
      expect(stats.tasks.total).toBe(20);
    });
  });

  describe('banUser', () => {
    it('throws ForbiddenException when admin tries to ban self', async () => {
      await expect(service.banUser('admin-1', 'admin-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ResourceNotFoundException if target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.banUser('user-99', 'admin-1')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('throws ForbiddenException if target is SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'super-1',
        systemRole: SystemRole.SUPER_ADMIN,
      });
      await expect(service.banUser('super-1', 'admin-1')).rejects.toThrow(ForbiddenException);
    });

    it('bans user, sets redis ban cache and logs activity', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-2',
        systemRole: SystemRole.USER,
        bannedAt: null,
      });

      await service.banUser('user-2', 'admin-1', 'Spamming');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { bannedAt: expect.any(Date) },
      });
      expect(redis.setex).toHaveBeenCalledWith('user-ban:user-2', 'banned', 300);
      expect(activity.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.user.banned' }),
      );
    });
  });

  describe('overridePlan', () => {
    it('throws ResourceNotFoundException if org is missing', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(service.overridePlan('org-99', Plan.PRO, 'admin-1')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('updates org plan and logs activity', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({ id: 'org-1', plan: Plan.FREE });

      await service.overridePlan('org-1', Plan.BUSINESS, 'admin-1');

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { plan: Plan.BUSINESS },
      });
      expect(activity.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.org.plan_overridden' }),
      );
    });
  });
});
