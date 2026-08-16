import { ScheduledExportScheduler } from './scheduled-export.scheduler';

function makePrisma() {
  return {
    organization: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeRedis(locked = true) {
  return { acquireCronLock: jest.fn().mockResolvedValue(locked) } as any;
}

function makeExportQueue() {
  return {
    addWeeklyTasksReport: jest.fn().mockResolvedValue(undefined),
    addBiweeklyProjectsReport: jest.fn().mockResolvedValue(undefined),
    addMonthlyOrgReport: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeLogger() {
  return { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

/** Helper to build org data as returned by getActiveOrgsWithOwners */
function fakeOrgRow(id: string, name: string, email: string, ownerName: string) {
  return {
    id,
    name,
    plan: 'PRO',
    members: [{ user: { email, name: ownerName } }],
  };
}

describe('ScheduledExportScheduler', () => {
  let scheduler: ScheduledExportScheduler;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let exportQueue: ReturnType<typeof makeExportQueue>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis(true);
    exportQueue = makeExportQueue();
    logger = makeLogger();
    scheduler = new ScheduledExportScheduler(prisma, redis, exportQueue, logger);
  });

  // ---------- scheduleWeeklyTasksReports ----------

  describe('scheduleWeeklyTasksReports', () => {
    it('skips when lock is not acquired', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.scheduleWeeklyTasksReports();

      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('queues one job per active org with an owner', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([
        fakeOrgRow('org-1', 'Acme', 'owner@acme.com', 'Owner A'),
        fakeOrgRow('org-2', 'Beta', 'owner@beta.com', 'Owner B'),
      ]);

      await scheduler.scheduleWeeklyTasksReports();

      expect(exportQueue.addWeeklyTasksReport).toHaveBeenCalledTimes(2);
      expect(exportQueue.addWeeklyTasksReport).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-1', ownerEmail: 'owner@acme.com' }),
      );
    });

    it('skips orgs with no owner (empty members)', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([
        { id: 'org-x', name: 'NoOwner', plan: 'PRO', members: [] },
      ]);

      await scheduler.scheduleWeeklyTasksReports();

      expect(exportQueue.addWeeklyTasksReport).not.toHaveBeenCalled();
    });

    it('catches and logs errors', async () => {
      prisma.organization.findMany.mockRejectedValueOnce(new Error('fail'));

      await expect(scheduler.scheduleWeeklyTasksReports()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule weekly'),
        expect.any(Error),
        'ScheduledExportScheduler',
      );
    });
  });

  // ---------- scheduleBiweeklyProjectsReports ----------

  describe('scheduleBiweeklyProjectsReports', () => {
    it('skips when lock is not acquired', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.scheduleBiweeklyProjectsReports();

      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('queues bi-weekly reports for each org', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([
        fakeOrgRow('org-1', 'Acme', 'o@a.com', 'Alice'),
      ]);

      await scheduler.scheduleBiweeklyProjectsReports();

      expect(exportQueue.addBiweeklyProjectsReport).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-1' }),
      );
    });

    it('catches and logs errors', async () => {
      prisma.organization.findMany.mockRejectedValueOnce(new Error('fail'));

      await expect(scheduler.scheduleBiweeklyProjectsReports()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule bi-weekly'),
        expect.any(Error),
        'ScheduledExportScheduler',
      );
    });
  });

  // ---------- scheduleMonthlyOrgReports ----------

  describe('scheduleMonthlyOrgReports', () => {
    it('skips when lock is not acquired', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.scheduleMonthlyOrgReports();

      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('queries with paidOnly filter and queues monthly reports', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([
        fakeOrgRow('org-pro', 'ProOrg', 'o@p.com', 'Pro Owner'),
      ]);

      await scheduler.scheduleMonthlyOrgReports();

      expect(exportQueue.addMonthlyOrgReport).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-pro' }),
      );
    });

    it('catches and logs errors', async () => {
      prisma.organization.findMany.mockRejectedValueOnce(new Error('fail'));

      await expect(scheduler.scheduleMonthlyOrgReports()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule monthly'),
        expect.any(Error),
        'ScheduledExportScheduler',
      );
    });
  });
});
