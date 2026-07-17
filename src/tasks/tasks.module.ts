import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
