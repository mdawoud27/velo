import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { EMAIL_QUEUE, REALTIME_EVICTION_QUEUE } from './constants';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';
import { RealtimeEvictionQueueService } from './realtime-eviction-queue.service';
import { RealtimeEvictionProcessor } from './realtime-eviction.processor';
import { MailModule } from 'src/mail/mail.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { SchedulersModule } from './schedulers/schedulers.module';

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
    BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: REALTIME_EVICTION_QUEUE }),
    MailModule,
    RealtimeModule,
    forwardRef(() => SchedulersModule),
  ],
  providers: [
    EmailQueueService,
    EmailProcessor,
    RealtimeEvictionQueueService,
    RealtimeEvictionProcessor,
  ],
  exports: [EmailQueueService, RealtimeEvictionQueueService],
})
export class QueueModule {}
