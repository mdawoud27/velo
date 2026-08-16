import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

function makeRedis(evalResult = 1, ttlResult = 300) {
  return {
    eval: jest.fn().mockResolvedValue(evalResult),
    ttl: jest.fn().mockResolvedValue(ttlResult),
  } as any;
}

function makeConfig(limit = 10) {
  return {
    get: jest.fn().mockReturnValue(limit),
  } as unknown as ConfigService;
}

function makeContext(userId = 'u-1') {
  const res = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: userId } }),
      getResponse: () => res,
    }),
    __res: res,
  } as any;
}

describe('AiRateLimitGuard', () => {
  it('returns true when current count is within limit', async () => {
    const redis = makeRedis(1);
    const guard = new AiRateLimitGuard(redis, makeConfig(10));

    const result = await guard.canActivate(makeContext());

    expect(result).toBe(true);
  });

  it('throws HttpException 429 when current count exceeds limit', async () => {
    const redis = makeRedis(11, 1800); // 11th request, 30m TTL
    const ctx = makeContext();
    const guard = new AiRateLimitGuard(redis, makeConfig(10));

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    expect(ctx.__res.setHeader).toHaveBeenCalledWith('Retry-After', '1800');
  });

  it('error payload contains AI_RATE_LIMIT_EXCEEDED code', async () => {
    const redis = makeRedis(15, 1200);
    const ctx = makeContext();
    const guard = new AiRateLimitGuard(redis, makeConfig(10));

    let err: any;
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const body = err.getResponse();
    expect(body.error.code).toBe('AI_RATE_LIMIT_EXCEEDED');
  });
});
