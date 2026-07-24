import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditInterceptor } from './interceptors';
import { EMAIL_QUEUE, EXPORT_QUEUE } from 'src/queue/constants';

const MANAGED_QUEUES = [EMAIL_QUEUE, EXPORT_QUEUE];

@Module({
  imports: [...MANAGED_QUEUES.map((name) => BullModule.registerQueue({ name }))],
  controllers: [AdminController],
  providers: [AdminService, AuditInterceptor],
})
export class AdminModule {}
