import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { IDEMPOTENCY_TTL_KEY } from '../constants';
import { IdempotencyInterceptor } from '../interceptors';

export function Idempotent(ttl = 60 * 60 * 24) {
  return applyDecorators(
    SetMetadata(IDEMPOTENCY_TTL_KEY, ttl),
    UseInterceptors(IdempotencyInterceptor),
  );
}
