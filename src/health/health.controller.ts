import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisHealthIndicator } from './redis.health';
import { Public } from 'src/auth/decorators';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisHealthIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
      () => this.db.pingCheck('prisma', this.prisma, { timeout: 5000 }),
      () => this.redisHealthIndicator.pingCheck('redis'),
    ]);
    return {
      ...result,
      version: process.env.npm_package_version,
    };
  }
}
