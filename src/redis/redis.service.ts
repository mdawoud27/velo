import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setex(key: string, value: string, ttl: number): Promise<void> {
    await this.client.setex(key, ttl, value);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async getex(key: string, ttlSeconds: number): Promise<string | null> {
    return this.client.getex(key, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // Distributed lock
  async acquireLock(resource: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(
      `lock:${resource}`,
      '1',
      'EX',
      ttlSeconds,
      'NX', // only set if not exists
    );
    return result === 'OK';
  }

  async releaseLock(resource: string): Promise<void> {
    await this.client.del(`lock:${resource}`);
  }
}
