import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indecator = this.healthIndicatorService.check(key);

    try {
      const result = await this.redisService.getClient().ping();
      return result === 'PONG' ? indecator.up() : indecator.down();
    } catch {
      return indecator.down();
    }
  }
}
