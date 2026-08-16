import { RedisHealthIndicator } from './redis.health';

function makeHealthIndicatorService() {
  const up = jest.fn().mockReturnValue({ redis: { status: 'up' } });
  const down = jest.fn().mockReturnValue({ redis: { status: 'down' } });
  return {
    check: jest.fn().mockReturnValue({ up, down }),
  } as any;
}

function makeRedisService(pingResult: string | Promise<string>) {
  return {
    getClient: () => ({
      ping: jest.fn().mockImplementation(() => Promise.resolve(pingResult)),
    }),
  } as any;
}

describe('RedisHealthIndicator', () => {
  it('returns up indicator when redis responds with PONG', async () => {
    const healthService = makeHealthIndicatorService();
    const redisService = makeRedisService('PONG');
    const indicator = new RedisHealthIndicator(healthService, redisService);

    const result = await indicator.pingCheck('redis');

    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('returns down indicator when redis responds with something other than PONG', async () => {
    const healthService = makeHealthIndicatorService();
    const redisService = makeRedisService('NOPE');
    const indicator = new RedisHealthIndicator(healthService, redisService);

    const result = await indicator.pingCheck('redis');

    expect(result).toEqual({ redis: { status: 'down' } });
  });

  it('returns down indicator when redis ping throws an error', async () => {
    const healthService = makeHealthIndicatorService();
    const redisService = {
      getClient: () => ({
        ping: jest.fn().mockRejectedValue(new Error('Connection lost')),
      }),
    } as any;
    const indicator = new RedisHealthIndicator(healthService, redisService);

    const result = await indicator.pingCheck('redis');

    expect(result).toEqual({ redis: { status: 'down' } });
  });
});
