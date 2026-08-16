import { ExecutionContext, CallHandler, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function makeRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    setNx: jest.fn().mockResolvedValue(true),
    eval: jest.fn().mockResolvedValue(1),
  } as any;
}

function makeReflector(ttl?: number) {
  return {
    get: jest.fn().mockReturnValue(ttl),
  } as unknown as Reflector;
}

function makeContext(
  idempotencyHeader?: string | string[],
  user?: any,
  method = 'POST',
  url = '/api/checkout',
): ExecutionContext {
  const res = { status: jest.fn(), statusCode: 200 };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: idempotencyHeader ? { 'idempotency-key': idempotencyHeader } : {},
        user,
        method,
        originalUrl: url,
      }),
      getResponse: () => res,
    }),
    __res: res,
  } as unknown as ExecutionContext;
}

function makeHandler(resultData = { created: true }): CallHandler {
  return {
    handle: jest.fn().mockReturnValue(of(resultData)),
  };
}

describe('IdempotencyInterceptor', () => {
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
  });

  it('passes through directly if no idempotency-key header is present', async () => {
    const interceptor = new IdempotencyInterceptor(redis, makeReflector());
    const ctx = makeContext(undefined);
    const handler = makeHandler();

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ created: true });
      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  it('throws ConflictException if idempotency-key header is an array', async () => {
    const interceptor = new IdempotencyInterceptor(redis, makeReflector());
    const ctx = makeContext(['key-1', 'key-2']);
    const handler = makeHandler();

    await expect(interceptor.intercept(ctx, handler)).rejects.toThrow(ConflictException);
  });

  it('returns cached response directly on key hit', async () => {
    const storedResponse = { statusCode: 201, body: { id: 'item-1' } };
    redis.get.mockResolvedValueOnce(JSON.stringify(storedResponse));

    const interceptor = new IdempotencyInterceptor(redis, makeReflector());
    const ctx = makeContext('key-123', { sub: 'u-1' });
    const handler = makeHandler();

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ id: 'item-1' });
      expect(ctx.__res.status).toHaveBeenCalledWith(201);
      expect(handler.handle).not.toHaveBeenCalled();
    });
  });

  it('throws ConflictException if key is currently in processing state', async () => {
    redis.get.mockResolvedValueOnce('PROCESSING:token-123');

    const interceptor = new IdempotencyInterceptor(redis, makeReflector());
    const ctx = makeContext('key-123');
    const handler = makeHandler();

    await expect(interceptor.intercept(ctx, handler)).rejects.toThrow(ConflictException);
  });

  it('acquires lock and executes request handler on first key submit', (done) => {
    redis.get.mockResolvedValueOnce(null);
    redis.setNx.mockResolvedValueOnce(true);

    const interceptor = new IdempotencyInterceptor(redis, makeReflector(86400));
    const ctx = makeContext('key-999', { sub: 'u-1' });
    const handler = makeHandler({ id: 'res-999' });

    interceptor.intercept(ctx, handler).then((result$) => {
      result$.subscribe((val) => {
        expect(val).toEqual({ id: 'res-999' });
        expect(redis.setNx).toHaveBeenCalledWith(
          'idempotency:u-1:POST:/api/checkout:key-999',
          expect.stringContaining('PROCESSING:'),
          30,
        );
        done();
      });
    });
  });
});
