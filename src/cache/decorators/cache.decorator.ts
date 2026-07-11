import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { CacheInterceptor } from '../interceptors';
import { CACHE_TTL_KEY, CACHE_TAGS_KEY } from '../constants';
import { JwtPayload } from 'src/auth/interfaces';

type AuthedRequest = Request & { user?: JwtPayload };

export type CacheTagsResolver = (req: AuthedRequest) => string[];

export function Cache(ttl: number, tags?: CacheTagsResolver) {
  return applyDecorators(
    SetMetadata(CACHE_TTL_KEY, ttl),
    SetMetadata(CACHE_TAGS_KEY, tags),
    UseInterceptors(CacheInterceptor),
  );
}
