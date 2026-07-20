import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [RealtimeModule, NotificationsModule, QueueModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
