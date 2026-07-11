import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from 'src/redis/redis.service';
import { JwtPayload } from 'src/auth/interfaces';
import {
  IDEMPOTENCY_TTL_KEY,
  IDEMPOTENCY_KEY_PREFIX,
  IDEMPOTENCY_LOCK_TTL_SECONDS,
  IDEMPOTENCY_PROCESSING_PREFIX,
} from '../constants';
import { randomUUID } from 'node:crypto';

interface StoredIdempotentResponse {
  statusCode: number;
  body: unknown;
}

type AuthedRequest = Request & {
  user?: JwtPayload;
  method: string;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const rawKey = request.headers['idempotency-key'];

    if (!rawKey) return next.handle();
    if (Array.isArray(rawKey)) {
      throw new ConflictException('Idempotency-Key header must be a single value');
    }

    const userId = request.user?.sub ?? 'guest';
    const redisKey = `${IDEMPOTENCY_KEY_PREFIX}:${userId}:${request.method}:${request.originalUrl}:${rawKey}`;

    const existing = await this.redis.get(redisKey);

    if (existing?.startsWith(IDEMPOTENCY_PROCESSING_PREFIX)) {
      throw new ConflictException('A request with this idempotency key is already being processed');
    }

    if (existing) {
      const stored = JSON.parse(existing) as StoredIdempotentResponse;
      context.switchToHttp().getResponse<Response>().status(stored.statusCode);
      return of(stored.body);
    }

    const token = randomUUID();
    const acquired = await this.redis.setNx(
      redisKey,
      `${IDEMPOTENCY_PROCESSING_PREFIX}${token}`,
      IDEMPOTENCY_LOCK_TTL_SECONDS,
    );

    if (!acquired) {
      throw new ConflictException('A request with this idempotency key is already being processed');
    }

    const ttl =
      this.reflector.get<number>(IDEMPOTENCY_TTL_KEY, context.getHandler()) ?? 60 * 60 * 24;

    return next.handle().pipe(
      tap({
        next: (body) => {
          const statusCode = context.switchToHttp().getResponse<Response>().statusCode;
          const stored: StoredIdempotentResponse = { statusCode, body };

          void this.redis
            .eval(
              `if redis.call("get", KEYS[1]) == ARGV[1] then
               return redis.call("setex", KEYS[1], ARGV[2], ARGV[3])
             else
               return 0
             end`,
              1,
              redisKey,
              `${IDEMPOTENCY_PROCESSING_PREFIX}${token}`,
              String(ttl),
              JSON.stringify(stored),
            )
            .catch((err) =>
              this.logger.error(`Failed to persist idempotent response for ${redisKey}`, err),
            );
        },
        error: () => {
          void this.redis
            .eval(
              `if redis.call("get", KEYS[1]) == ARGV[1] then
               return redis.call("del", KEYS[1])
             else
               return 0
             end`,
              1,
              redisKey,
              `${IDEMPOTENCY_PROCESSING_PREFIX}${token}`,
            )
            .catch((err) =>
              this.logger.error(`Failed to release idempotency lock ${redisKey}`, err),
            );
        },
      }),
    );
  }
}
