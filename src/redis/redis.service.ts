import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject('REDIS_CLIENT') private readonly client: Redis,
    private readonly logger: LoggerService,
  ) {}

  getClient() {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setex(key: string, value: string, ttl: number): Promise<void> {
    this.validateTtl(ttl);
    await this.client.setex(key, ttl, value);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async getdel(key: string): Promise<string | null> {
    return await this.client.getdel(key);
  }

  async getex(key: string, ttl: number): Promise<string | null> {
    this.validateTtl(ttl);
    return await this.client.getex(key, 'EX', ttl);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  async expire(key: string, ttl: number): Promise<number> {
    this.validateTtl(ttl);
    return await this.client.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  eval(script: string, numkeys: number, ...args: string[]): Promise<unknown> {
    return this.client.eval(script, numkeys, ...args);
  }

  // Distributed lock
  async acquireLock(resource: string, ttl: number): Promise<string | null> {
    this.validateTtl(ttl);
    const token = randomUUID();
    const result = await this.client.set(
      `lock:${resource}`,
      token,
      'EX',
      ttl,
      'NX', // only set if not exists
    );
    return result === 'OK' ? token : null;
  }

  async releaseLock(resource: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, `lock:${resource}`, token);
    return result === 1;
  }

  async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  }

  async sadd(key: string, member: string): Promise<number> {
    return this.client.sadd(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  private validateTtl(ttl: number): void {
    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new Error(`Invalid TTL: must be a positive integer, got ${ttl}`);
    }
  }
}
