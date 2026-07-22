import { Module } from '@nestjs/common';
import { DueDateScheduler } from './due-date.scheduler';

@Module({
  providers: [DueDateScheduler],
})
export class SchedulersModule {}
