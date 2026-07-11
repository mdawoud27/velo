import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './interceptors';

@Global()
@Module({
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService],
})
export class CacheModule {}
