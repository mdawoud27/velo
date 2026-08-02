import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { RedisService } from 'src/redis/redis.service';
import { INCR_WITH_TTL_SCRIPT } from '../constants';
import type { JwtPayload } from 'src/auth/interfaces';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const { user } = request;

    const key = `ai:rate:${user.sub}`;
    const limit = this.config.get<number>('AI_RATE_LIMIT_PER_HOUR', 10);
    const windowSeconds = 3600;

    // Atomic: INCR + conditional EXPIRE in one round-trip
    const current = (await this.redis.eval(
      INCR_WITH_TTL_SCRIPT,
      1,
      key,
      String(windowSeconds),
    )) as number;

    if (current > limit) {
      const ttl = await this.redis.ttl(key);
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('Retry-After', String(Math.max(ttl, 0)));

      throw new HttpException(
        {
          success: false,
          error: {
            code: 'AI_RATE_LIMIT_EXCEEDED',
            message: `AI rate limit of ${limit} requests/hour exceeded. Try again in ${Math.ceil(ttl / 60)} minutes.`,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
