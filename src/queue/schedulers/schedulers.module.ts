import { Module } from '@nestjs/common';
import { BillingScheduler } from './billing.scheduler';
import { CleanupScheduler } from './cleanup.scheduler';
import { DueDateScheduler } from './due-date.scheduler';

@Module({
  providers: [DueDateScheduler, BillingScheduler, CleanupScheduler],
})
export class SchedulersModule {}
