import { EventEmitter } from 'events';
import { assertSafeTestDatabaseUrl } from './database-safety';

jest.setTimeout(30000);
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/velo_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars-long';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.JWT_2FA_CHALLENGE_SECRET =
  process.env.JWT_2FA_CHALLENGE_SECRET || 'test-2fa-challenge-secret';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.JWT_2FA_CHALLENGE_EXPIRES_IN = process.env.JWT_2FA_CHALLENGE_EXPIRES_IN || '10m';

assertSafeTestDatabaseUrl();

class MockRedis extends EventEmitter {
  private static sharedStore = new Map<string, string>();
  private static sharedHashes = new Map<string, Map<string, string>>();
  private static sharedSets = new Map<string, Set<string>>();

  private get store() {
    return MockRedis.sharedStore;
  }
  private get hashes() {
    return MockRedis.sharedHashes;
  }
  private get sets() {
    return MockRedis.sharedSets;
  }

  public status = 'ready';

  constructor() {
    super();
    process.nextTick(() => {
      this.emit('connect');
      this.emit('ready');
    });
  }

  async flushdb() {
    MockRedis.sharedStore.clear();
    MockRedis.sharedHashes.clear();
    MockRedis.sharedSets.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  async info() {
    return 'redis_version:7.0.0\r\nserver:standalone\r\n';
  }

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async getex(key: string, mode: string, ttl: number) {
    void mode;
    void ttl;
    return this.store.get(key) ?? null;
  }

  async set(key: string, val: string) {
    this.store.set(key, val);
    return 'OK';
  }

  async setex(key: string, ttl: number, val: string) {
    void ttl;
    this.store.set(key, val);
    return 'OK';
  }

  async expire(key: string, ttl: number) {
    void key;
    void ttl;
    return 1;
  }

  async incr(key: string) {
    const curr = parseInt(this.store.get(key) ?? '0', 10);
    const next = curr + 1;
    this.store.set(key, next.toString());
    return next;
  }

  async call(...args: any[]) {
    void args;
    return 1;
  }

  async del(...keys: string[]) {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async getdel(key: string) {
    const val = this.store.get(key) ?? null;
    this.store.delete(key);
    return val;
  }

  async ttl() {
    return 3600;
  }

  async exists(key: string) {
    return this.store.has(key) ? 1 : 0;
  }

  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hset(key: string, field: string, val: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key)!.set(field, val);
    return 1;
  }

  async hdel(key: string, field: string) {
    return this.hashes.get(key)?.delete(field) ? 1 : 0;
  }

  async sadd(key: string, ...members: string[]) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const set = this.sets.get(key)!;
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  }

  async smembers(key: string) {
    return Array.from(this.sets.get(key) ?? []);
  }

  async eval() {
    return 1;
  }

  async evalsha() {
    return 1;
  }

  async script() {
    return 'sha';
  }

  async defineCommand() {}

  async quit() {
    return 'OK';
  }

  async disconnect() {
    return 'OK';
  }

  duplicate() {
    return new MockRedis();
  }
}

jest.mock('ioredis', () => {
  const Mock = jest.fn().mockImplementation(() => new MockRedis());
  (Mock as any).Redis = Mock;
  (Mock as any).default = Mock;
  return Mock;
});
