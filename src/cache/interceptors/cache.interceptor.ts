import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { RedisService } from 'src/redis/redis.service';
import { JwtPayload } from 'src/auth/interfaces';
import { CACHE_TTL_KEY, CACHE_TAGS_KEY, CACHE_INDEX_PREFIX } from '../constants';
import { CacheTagsResolver } from '../decorators';
import { CacheTags } from '../cache.tags';

type AuthedRequest = Request & { user?: JwtPayload };

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler());

    if (!ttl) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthedRequest>();

    if (request.method !== 'GET') {
      this.logger.warn(
        `@Cache applied to non-GET handler ${request.method} ${request.originalUrl} — skipping cache`,
      );
      return next.handle();
    }

    const cacheKey = this.buildCacheKey(request);

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return of(JSON.parse(cached));
    }

    const tagsResolver = this.reflector.get<CacheTagsResolver | undefined>(
      CACHE_TAGS_KEY,
      context.getHandler(),
    );
    const tags = this.resolveTags(request, tagsResolver);

    return next.handle().pipe(
      tap((response) => {
        void this.writeCache(cacheKey, response, ttl, tags).catch((err) => {
          this.logger.error(`Failed to write cache for ${cacheKey}`, err);
        });
      }),
    );
  }

  private buildCacheKey(request: AuthedRequest): string {
    const userId = request.user?.sub ?? 'guest';
    return `cache:${userId}:${request.method}:${request.originalUrl}`;
  }

  private resolveTags(request: AuthedRequest, resolver?: CacheTagsResolver): string[] {
    const userId = request.user?.sub ?? 'guest';
    const baseTag = CacheTags.user(userId);

    if (!resolver) {
      return [baseTag];
    }

    const resolved = resolver(request).filter(Boolean);
    return [baseTag, ...resolved];
  }

  private async writeCache(
    cacheKey: string,
    response: unknown,
    ttl: number,
    tags: string[],
  ): Promise<void> {
    const serialized = JSON.stringify(response);

    await this.redis.setex(cacheKey, serialized, ttl);

    await Promise.all(
      tags.map(async (tag) => {
        const indexKey = `${CACHE_INDEX_PREFIX}:${tag}`;
        await this.redis.sadd(indexKey, cacheKey);
        await this.redis.expire(indexKey, ttl);
      }),
    );
  }
}
