import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { CacheInterceptor } from './cache.interceptor';

function makeRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    sadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  } as any;
}

function makeReflector(ttl?: number, tagsResolver?: any) {
  return {
    get: jest.fn().mockImplementation((key) => {
      if (key === 'cache:ttl') return ttl;
      if (key === 'cache:tags') return tagsResolver;
      return undefined;
    }),
  } as unknown as Reflector;
}

function makeContext(method = 'GET', url = '/api/projects', user?: any): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        originalUrl: url,
        user,
      }),
    }),
  } as unknown as ExecutionContext;
}

function makeCallHandler(responseData: any = { data: 'test' }): CallHandler {
  return {
    handle: jest.fn().mockReturnValue(of(responseData)),
  };
}

describe('CacheInterceptor', () => {
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
  });

  it('passes through directly if no TTL metadata is found', async () => {
    const reflector = makeReflector(undefined);
    const interceptor = new CacheInterceptor(redis, reflector);
    const ctx = makeContext();
    const handler = makeCallHandler();

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ data: 'test' });
      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  it('skips caching for non-GET methods', async () => {
    const reflector = makeReflector(60);
    const interceptor = new CacheInterceptor(redis, reflector);
    const ctx = makeContext('POST', '/api/projects');
    const handler = makeCallHandler();

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ data: 'test' });
      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  it('returns cached data if cache hit', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
    const reflector = makeReflector(60);
    const interceptor = new CacheInterceptor(redis, reflector);
    const ctx = makeContext('GET', '/api/projects', { sub: 'user-1' });
    const handler = makeCallHandler();

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ cached: true });
      expect(handler.handle).not.toHaveBeenCalled();
    });
  });

  it('handles corrupted JSON in cache hit gracefully by falling through', async () => {
    redis.get.mockResolvedValueOnce('invalid json {');
    const reflector = makeReflector(60);
    const interceptor = new CacheInterceptor(redis, reflector);
    const ctx = makeContext('GET', '/api/projects', { sub: 'user-1' });
    const handler = makeCallHandler({ fresh: true });

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ fresh: true });
      expect(handler.handle).toHaveBeenCalled();
    });
  });

  it('writes cache on cache miss with default base user tag', (done) => {
    const reflector = makeReflector(60);
    const interceptor = new CacheInterceptor(redis, reflector);
    const ctx = makeContext('GET', '/api/projects', { sub: 'user-1' });
    const handler = makeCallHandler({ data: 'fresh' });

    interceptor.intercept(ctx, handler).then((result$) => {
      result$.subscribe((val) => {
        expect(val).toEqual({ data: 'fresh' });

        setImmediate(() => {
          expect(redis.setex).toHaveBeenCalledWith(
            'cache:user-1:GET:/api/projects',
            JSON.stringify({ data: 'fresh' }),
            60,
          );
          expect(redis.sadd).toHaveBeenCalledWith(
            'cache:idx:user:user-1',
            'cache:user-1:GET:/api/projects',
          );
          done();
        });
      });
    });
  });
});
