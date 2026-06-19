import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { EMAIL_QUEUE } from './constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        }) as ConnectionOptions,
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
})
export class QueueModule {}
