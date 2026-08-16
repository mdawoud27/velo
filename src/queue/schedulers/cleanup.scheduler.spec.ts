import { CleanupScheduler } from './cleanup.scheduler';

function makePrisma() {
  return {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    orgInvitation: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

function makeRedis(locked = true) {
  return { acquireCronLock: jest.fn().mockResolvedValue(locked) } as any;
}

function makeLogger() {
  return { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

describe('CleanupScheduler', () => {
  let scheduler: CleanupScheduler;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis(true);
    logger = makeLogger();
    scheduler = new CleanupScheduler(prisma, redis, logger);
  });

  // ---------- purgeOldSoftDeletedTasks ----------

  describe('purgeOldSoftDeletedTasks', () => {
    it('skips execution when cron lock acquisition fails', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.purgeOldSoftDeletedTasks();

      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('purges tasks in batches and logs total count', async () => {
      // First batch: 2 tasks (under batch size → single loop iteration)
      prisma.task.findMany.mockResolvedValueOnce([{ id: 't-1' }, { id: 't-2' }]);
      prisma.task.deleteMany.mockResolvedValueOnce({ count: 2 });

      await scheduler.purgeOldSoftDeletedTasks();

      expect(prisma.task.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['t-1', 't-2'] } },
      });
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Purged 2 task(s)'));
    });

    it('logs debug when no tasks to purge', async () => {
      prisma.task.findMany.mockResolvedValueOnce([]);

      await scheduler.purgeOldSoftDeletedTasks();

      expect(prisma.task.deleteMany).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('No tasks to purge');
    });

    it('catches and logs errors without rethrowing', async () => {
      prisma.task.findMany.mockRejectedValueOnce(new Error('DB timeout'));

      await expect(scheduler.purgeOldSoftDeletedTasks()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup cron failed'),
        expect.any(Error),
        'CleanupScheduler',
      );
    });
  });

  // ---------- purgeExpiredInvitations ----------

  describe('purgeExpiredInvitations', () => {
    it('skips execution when cron lock acquisition fails', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.purgeExpiredInvitations();

      expect(prisma.orgInvitation.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes expired invitations and logs count', async () => {
      prisma.orgInvitation.deleteMany.mockResolvedValueOnce({ count: 5 });

      await scheduler.purgeExpiredInvitations();

      expect(prisma.orgInvitation.deleteMany).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Purged 5 expired'));
    });

    it('does not log when no expired invitations found', async () => {
      prisma.orgInvitation.deleteMany.mockResolvedValueOnce({ count: 0 });

      await scheduler.purgeExpiredInvitations();

      expect(logger.log).not.toHaveBeenCalled();
    });

    it('catches and logs errors without rethrowing', async () => {
      prisma.orgInvitation.deleteMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(scheduler.purgeExpiredInvitations()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invitation cleanup cron failed'),
        expect.any(Error),
        'CleanupScheduler',
      );
    });
  });
});
