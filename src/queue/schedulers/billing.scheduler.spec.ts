import { BillingScheduler } from './billing.scheduler';

function makePrisma() {
  return {
    organization: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

function makeEmailQueue() {
  return { addSubscriptionExpiryWarning: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeRedis(locked = true) {
  return { acquireCronLock: jest.fn().mockResolvedValue(locked) } as any;
}

function makeLogger() {
  return { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

describe('BillingScheduler', () => {
  let scheduler: BillingScheduler;
  let prisma: ReturnType<typeof makePrisma>;
  let emailQueue: ReturnType<typeof makeEmailQueue>;
  let redis: ReturnType<typeof makeRedis>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    prisma = makePrisma();
    emailQueue = makeEmailQueue();
    redis = makeRedis(true);
    logger = makeLogger();
    scheduler = new BillingScheduler(prisma, emailQueue, redis, logger);
  });

  // ---------- warnExpiringSubscriptions ----------

  describe('warnExpiringSubscriptions', () => {
    it('skips execution when cron lock acquisition fails', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.warnExpiringSubscriptions();

      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('sends expiry warnings for each org with an owner', async () => {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      prisma.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-1',
          name: 'Acme',
          plan: 'PRO',
          stripeCurrentPeriodEnd: expiresAt,
          members: [{ user: { email: 'owner@acme.com', name: 'Owner', notifPreferences: null } }],
        },
      ]);

      await scheduler.warnExpiringSubscriptions();

      expect(emailQueue.addSubscriptionExpiryWarning).toHaveBeenCalledWith({
        email: 'owner@acme.com',
        orgName: 'Acme',
        expiresAt,
      });
    });

    it('skips orgs without an owner and logs a warning', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-2',
          name: 'EmptyOrg',
          plan: 'BUSINESS',
          stripeCurrentPeriodEnd: new Date(),
          members: [],
        },
      ]);

      await scheduler.warnExpiringSubscriptions();

      expect(emailQueue.addSubscriptionExpiryWarning).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('org-2'));
    });

    it('catches and logs errors without rethrowing', async () => {
      prisma.organization.findMany.mockRejectedValueOnce(new Error('DB down'));

      await expect(scheduler.warnExpiringSubscriptions()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Subscription expiry warning cron failed'),
        expect.any(Error),
        'BillingScheduler',
      );
    });
  });

  // ---------- downgradeExpiredSubscriptions ----------

  describe('downgradeExpiredSubscriptions', () => {
    it('skips execution when cron lock acquisition fails', async () => {
      redis.acquireCronLock.mockResolvedValueOnce(false);

      await scheduler.downgradeExpiredSubscriptions();

      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('downgrades expired orgs and logs count', async () => {
      prisma.organization.updateMany.mockResolvedValueOnce({ count: 3 });

      await scheduler.downgradeExpiredSubscriptions();

      expect(prisma.organization.updateMany).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Downgraded 3'));
    });

    it('does not log when no orgs are downgraded', async () => {
      prisma.organization.updateMany.mockResolvedValueOnce({ count: 0 });

      await scheduler.downgradeExpiredSubscriptions();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('catches and logs errors without rethrowing', async () => {
      prisma.organization.updateMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(scheduler.downgradeExpiredSubscriptions()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Subscription downgrade cron failed'),
        expect.any(Error),
        'BillingScheduler',
      );
    });
  });
});
