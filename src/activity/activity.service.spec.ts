import { ForbiddenException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ActivityService } from './activity.service';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';

function makePrisma() {
  return {
    activityLog: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log-1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findUnique: jest.fn(),
    },
    orgMember: {
      findUnique: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
  } as any;
}

function makeLogger() {
  return {
    error: jest.fn(),
  } as any;
}

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: ReturnType<typeof makePrisma>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    prisma = makePrisma();
    logger = makeLogger();
    service = new ActivityService(prisma, logger);
  });

  describe('log', () => {
    it('creates an activity log record', async () => {
      service.log({
        action: 'task.created',
        entityType: 'Task',
        entityId: 't-1',
        actorId: 'u-1',
        orgId: 'org-1',
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          action: 'task.created',
          entityType: 'Task',
          entityId: 't-1',
          actorId: 'u-1',
          metadata: {},
          projectId: undefined,
          orgId: 'org-1',
        },
      });
    });

    it('logs an error when activity log creation rejects', async () => {
      const dbErr = new Error('DB connection fail');
      prisma.activityLog.create.mockRejectedValueOnce(dbErr);

      service.log({
        action: 'task.updated',
        entityType: 'Task',
        entityId: 't-1',
        actorId: 'u-1',
      });

      // Wait a tick for catch block
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith('Activity log failed:', dbErr, {
        service: 'ActivityService',
      });
    });
  });

  describe('listActivityLogs', () => {
    const validUser = { id: 'u-1', bannedAt: null, deletedAt: null };
    const ownerMember = { userId: 'u-1', orgId: 'org-1', role: OrgRole.OWNER };

    it('throws ResourceNotFoundException if requester user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.listActivityLogs({
          page: 1,
          limit: 10,
          orgId: 'org-1',
          requesterId: 'u-1',
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('throws BannedUserException if requester is banned', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...validUser, bannedAt: new Date() });

      await expect(
        service.listActivityLogs({
          page: 1,
          limit: 10,
          orgId: 'org-1',
          requesterId: 'u-1',
        }),
      ).rejects.toThrow(BannedUserException);
    });

    it('throws ResourceNotFoundException if requester is soft-deleted', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...validUser, deletedAt: new Date() });

      await expect(
        service.listActivityLogs({
          page: 1,
          limit: 10,
          orgId: 'org-1',
          requesterId: 'u-1',
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('throws ForbiddenException if requester is not an org MEMBER or is a non-admin MEMBER', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(validUser);
      prisma.orgMember.findUnique.mockResolvedValueOnce({ ...ownerMember, role: OrgRole.MEMBER });

      await expect(
        service.listActivityLogs({
          page: 1,
          limit: 10,
          orgId: 'org-1',
          requesterId: 'u-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ResourceNotFoundException if requested projectId is not found in org', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(validUser);
      prisma.orgMember.findUnique.mockResolvedValueOnce(ownerMember);
      prisma.project.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.listActivityLogs({
          page: 1,
          limit: 10,
          orgId: 'org-1',
          projectId: 'p-99',
          requesterId: 'u-1',
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('returns paginated activity logs when authorized', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(validUser);
      prisma.orgMember.findUnique.mockResolvedValueOnce(ownerMember);
      prisma.activityLog.findMany.mockResolvedValueOnce([
        { id: 'log-1', action: 'task.created', actor: { id: 'u-1', name: 'User' } },
      ]);
      prisma.activityLog.count.mockResolvedValueOnce(1);

      const result = await service.listActivityLogs({
        page: 1,
        limit: 10,
        orgId: 'org-1',
        requesterId: 'u-1',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
