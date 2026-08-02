import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditInterceptor } from './interceptors';
import { MANAGED_QUEUES } from './constants';

@Module({
  imports: [...MANAGED_QUEUES.map((name) => BullModule.registerQueue({ name }))],
  controllers: [AdminController],
  providers: [AdminService, AuditInterceptor],
})
export class AdminModule {}
