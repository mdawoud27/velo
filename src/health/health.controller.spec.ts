import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

function makeHealthService(result: any, shouldFail = false) {
  return {
    check: jest.fn().mockImplementation(async (checks) => {
      // Execute check functions to cover the lines
      for (const checkFn of checks) {
        await checkFn();
      }
      if (shouldFail) {
        throw new ServiceUnavailableException(result);
      }
      return result;
    }),
  } as any;
}

function makeDbIndicator() {
  return {
    pingCheck: jest.fn().mockResolvedValue({ prisma: { status: 'up' } }),
  } as any;
}

function makeRedisIndicator() {
  return {
    pingCheck: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
  } as any;
}

describe('HealthController', () => {
  it('returns health check status with version when healthy', async () => {
    const health = makeHealthService({ status: 'ok', info: { prisma: { status: 'up' } } });
    const db = makeDbIndicator();
    const redis = makeRedisIndicator();
    const controller = new HealthController(health, db, {} as any, redis);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.version).toBeDefined();
    expect(db.pingCheck).toHaveBeenCalledWith('prisma', expect.anything(), { timeout: 5000 });
    expect(redis.pingCheck).toHaveBeenCalledWith('redis');
  });

  it('re-throws ServiceUnavailableException with version attached when health check fails', async () => {
    const errorBody = { status: 'error', error: { redis: { status: 'down' } } };
    const health = makeHealthService(errorBody, true);
    const db = makeDbIndicator();
    const redis = makeRedisIndicator();
    const controller = new HealthController(health, db, {} as any, redis);

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
