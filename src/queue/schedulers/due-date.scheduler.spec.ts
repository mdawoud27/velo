import { DueDateScheduler } from './due-date.scheduler';

function makePrisma() {
  return {
    task: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

function makeEmailQueue() {
  return { addDueReminderEmail: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeRedis(locked = true) {
  return { acquireCronLock: jest.fn().mockResolvedValue(locked) } as any;
}

function makeLogger() {
  return { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

describe('DueDateScheduler', () => {
  let scheduler: DueDateScheduler;
  let prisma: ReturnType<typeof makePrisma>;
  let emailQueue: ReturnType<typeof makeEmailQueue>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    emailQueue = makeEmailQueue();
    redis = makeRedis(true);
    scheduler = new DueDateScheduler(prisma, emailQueue, redis, makeLogger());
  });

  it('skips execution if cron lock acquisition fails', async () => {
    redis.acquireCronLock.mockResolvedValueOnce(false);
    await scheduler.runNow();

    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('queries tasks due in the next 24 hours and enqueues reminder emails', async () => {
    const task = {
      id: 't-1',
      title: 'Finish report',
      dueDate: new Date(Date.now() + 12 * 3600 * 1000),
      assignee: { id: 'u-1', email: 'u1@test.com', name: 'User 1' },
    };
    prisma.task.findMany.mockResolvedValueOnce([task]);

    await scheduler.runNow();

    expect(emailQueue.addDueReminderEmail).toHaveBeenCalledWith(
      task.assignee,
      expect.objectContaining({ taskTitle: 'Finish report' }),
    );
  });
});
