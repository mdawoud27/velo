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
  IDEMPOTENCY_PROCESSING_MARKER,
} from '../constants';

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

    // No key supplied — this request just behaves normally, no dedup applied.
    if (!rawKey) {
      return next.handle();
    }

    if (Array.isArray(rawKey)) {
      throw new ConflictException('Idempotency-Key header must be a single value');
    }

    const userId = request.user?.sub ?? 'guest';
    const redisKey = `${IDEMPOTENCY_KEY_PREFIX}:${userId}:${request.method}:${request.originalUrl}:${rawKey}`;

    const existing = await this.redis.get(redisKey);

    if (existing === IDEMPOTENCY_PROCESSING_MARKER) {
      // A duplicate request arrived while the original is still running.
      throw new ConflictException('A request with this idempotency key is already being processed');
    }

    if (existing) {
      // A completed response already exists — replay it verbatim, including
      // its original status code, instead of re-running the handler.
      const stored = JSON.parse(existing) as StoredIdempotentResponse;
      context.switchToHttp().getResponse<Response>().status(stored.statusCode);
      return of(stored.body);
    }

    // Atomically claim this key before doing any work. If two requests race
    // here, only one SETNX succeeds — the loser gets a 409 instead of both
    // proceeding to create a duplicate resource.
    const acquired = await this.redis.setNx(
      redisKey,
      IDEMPOTENCY_PROCESSING_MARKER,
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
            .setex(redisKey, JSON.stringify(stored), ttl)
            .catch((err) =>
              this.logger.error(`Failed to persist idempotent response for ${redisKey}`, err),
            );
        },
        error: () => {
          // The handler failed — release the lock immediately so the client
          // can safely retry with the same key, rather than being stuck
          // behind the lock TTL for a request that never actually succeeded.
          void this.redis
            .del(redisKey)
            .catch((err) =>
              this.logger.error(`Failed to release idempotency lock ${redisKey}`, err),
            );
        },
      }),
    );
  }
}
