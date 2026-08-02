import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '../interceptors';
import { CACHE_TTL_KEY, CACHE_TAGS_KEY } from '../constants';
import { CacheTagsResolver } from '../types';

export function Cache(ttl: number, tags?: CacheTagsResolver) {
  return applyDecorators(
    SetMetadata(CACHE_TTL_KEY, ttl),
    SetMetadata(CACHE_TAGS_KEY, tags),
    UseInterceptors(CacheInterceptor),
  );
}
