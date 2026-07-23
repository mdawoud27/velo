import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { EMAIL_QUEUE, EXPORT_QUEUE, REALTIME_EVICTION_QUEUE } from './constants';
import { EmailQueueService } from './services/email-queue.service';
import { EmailProcessor } from './processors/email.processor';
import { RealtimeEvictionQueueService } from './services/realtime-eviction-queue.service';
import { RealtimeEvictionProcessor } from './processors/realtime-eviction.processor';
import { MailModule } from 'src/mail/mail.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { DueDateScheduler } from './schedulers/due-date.scheduler';
import { BillingScheduler } from './schedulers/billing.scheduler';
import { CleanupScheduler } from './schedulers/cleanup.scheduler';
import { ExportProcessor } from './processors';
import { ExportQueueService } from './services';
import { ScheduledExportScheduler } from './schedulers';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

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
    BullModule.registerQueue(
      { name: EMAIL_QUEUE },
      { name: REALTIME_EVICTION_QUEUE },
      { name: EXPORT_QUEUE },
    ),
    MailModule,
    RealtimeModule,
    CloudinaryModule,
  ],
  providers: [
    EmailQueueService,
    ExportQueueService,
    RealtimeEvictionQueueService,
    EmailProcessor,
    ExportProcessor,
    RealtimeEvictionProcessor,
    DueDateScheduler,
    BillingScheduler,
    CleanupScheduler,
    ScheduledExportScheduler,
  ],
  exports: [EmailQueueService, RealtimeEvictionQueueService, ExportQueueService],
})
export class QueueModule {}
