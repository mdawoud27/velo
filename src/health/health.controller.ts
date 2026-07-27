import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisHealthIndicator } from './redis.health';
import { Public } from 'src/auth/decorators';
import { SkipThrottle } from '@nestjs/throttler';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisHealthIndicator: RedisHealthIndicator,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @HealthCheck()
  async check() {
    const { version } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version: string;
    };
    try {
      const result = await this.health.check([
        () => this.db.pingCheck('prisma', this.prisma, { timeout: 5000 }),
        () => this.redisHealthIndicator.pingCheck('redis'),
      ]);
      return { ...result, version };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        const body = error.getResponse() as HealthCheckResult;
        throw new ServiceUnavailableException({ ...body, version });
      }
      throw error;
    }
  }
}
