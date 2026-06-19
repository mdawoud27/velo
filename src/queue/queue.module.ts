import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { EMAIL_QUEUE } from './constants';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';
import { MailModule } from 'src/mail/mail.module';

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
    MailModule,
  ],
  providers: [EmailQueueService, EmailProcessor],
  exports: [EmailQueueService],
})
export class QueueModule {}
