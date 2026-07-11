import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './interceptors';

@Module({
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
