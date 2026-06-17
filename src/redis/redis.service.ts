import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject('REDIS_CLIENT') private readonly client: Redis,
    private readonly logger: LoggerService,
  ) {}

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

  async getex(key: string, ttl: number): Promise<string | null> {
    this.validateTtl(ttl);
    return this.client.getex(key, 'EX', ttl);
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

  async expire(key: string, ttl: number): Promise<number> {
    this.validateTtl(ttl);
    return await this.client.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // Distributed lock
  async acquireLock(resource: string, ttl: number): Promise<boolean> {
    this.validateTtl(ttl);
    const result = await this.client.set(
      `lock:${resource}`,
      '1',
      'EX',
      ttl,
      'NX', // only set if not exists
    );
    return result === 'OK';
  }

  async releaseLock(resource: string): Promise<void> {
    await this.client.del(`lock:${resource}`);
  }

  private validateTtl(ttl: number): void {
    if (!Number.isInteger(ttl) || ttl <= 0) {
      this.logger.error(
        `Invalid ttl: must be a positive integer, got ${ttl}`,
        undefined,
        'RedisService',
      );
    }
  }
}
