import { forwardRef, Module } from '@nestjs/common';
import { BillingScheduler } from './billing.scheduler';
import { CleanupScheduler } from './cleanup.scheduler';
import { DueDateScheduler } from './due-date.scheduler';
import { QueueModule } from '../queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  providers: [DueDateScheduler, BillingScheduler, CleanupScheduler],
})
export class SchedulersModule {}
