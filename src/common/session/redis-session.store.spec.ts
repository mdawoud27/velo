import { RedisSessionStore } from './redis-session.store';
import { RedisService } from 'src/redis/redis.service';
import type { SessionData } from 'express-session';

function makeRedis(overrides: Partial<Record<string, jest.Mock>> = {}): jest.Mocked<RedisService> {
  return {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<RedisService>;
}

function makeSession(maxAge: number | null | undefined = 60_000): SessionData {
  return {
    cookie: { maxAge } as any,
  } as SessionData;
}

describe('RedisSessionStore', () => {
  const SID = 'test-sid-123';
  const KEY = `sess:${SID}`;

  describe('get()', () => {
    it('returns null when the key is not in Redis', (done) => {
      const store = new RedisSessionStore(makeRedis());
      store.get(SID, (err, session) => {
        expect(err).toBeNull();
        expect(session).toBeNull();
        done();
      });
    });

    it('deserialises and returns the session when found', (done) => {
      const session = makeSession();
      const redis = makeRedis({ get: jest.fn().mockResolvedValue(JSON.stringify(session)) });
      const store = new RedisSessionStore(redis);

      store.get(SID, (err, result) => {
        expect(err).toBeNull();
        expect(result).toEqual(session);
        expect(redis.get).toHaveBeenCalledWith(KEY);
        done();
      });
    });

    it('forwards errors from Redis to the callback', (done) => {
      const redisError = new Error('Redis connection lost');
      const redis = makeRedis({ get: jest.fn().mockRejectedValue(redisError) });
      const store = new RedisSessionStore(redis);

      store.get(SID, (err) => {
        expect(err).toBe(redisError);
        done();
      });
    });
  });

  describe('set()', () => {
    it('serialises and stores the session with TTL derived from maxAge', (done) => {
      const redis = makeRedis();
      const store = new RedisSessionStore(redis);
      const session = makeSession(30_000); // 30 s

      store.set(SID, session, (err) => {
        expect(err).toBeUndefined();
        expect(redis.setex).toHaveBeenCalledWith(KEY, JSON.stringify(session), 30);
        done();
      });
    });

    it('uses default TTL of 600 s when maxAge is null', (done) => {
      const redis = makeRedis();
      const store = new RedisSessionStore(redis);
      const session = makeSession(null);

      store.set(SID, session, (err) => {
        expect(err).toBeUndefined();
        expect(redis.setex).toHaveBeenCalledWith(KEY, JSON.stringify(session), 600);
        done();
      });
    });

    it('forwards set errors to the callback', (done) => {
      const redisError = new Error('write error');
      const redis = makeRedis({ setex: jest.fn().mockRejectedValue(redisError) });
      const store = new RedisSessionStore(redis);

      store.set(SID, makeSession(), (err) => {
        expect(err).toBe(redisError);
        done();
      });
    });
  });

  describe('destroy()', () => {
    it('deletes the session key from Redis', (done) => {
      const redis = makeRedis();
      const store = new RedisSessionStore(redis);

      store.destroy(SID, (err) => {
        expect(err).toBeUndefined();
        expect(redis.del).toHaveBeenCalledWith(KEY);
        done();
      });
    });

    it('forwards destroy errors to the callback', (done) => {
      const redisError = new Error('del error');
      const redis = makeRedis({ del: jest.fn().mockRejectedValue(redisError) });
      const store = new RedisSessionStore(redis);

      store.destroy(SID, (err) => {
        expect(err).toBe(redisError);
        done();
      });
    });
  });

  describe('touch()', () => {
    it('refreshes the session TTL', (done) => {
      const redis = makeRedis();
      const store = new RedisSessionStore(redis);
      const session = makeSession(120_000); // 120 s

      store.touch(SID, session, (err) => {
        expect(err).toBeUndefined();
        expect(redis.setex).toHaveBeenCalledWith(KEY, JSON.stringify(session), 120);
        done();
      });
    });
  });
});
