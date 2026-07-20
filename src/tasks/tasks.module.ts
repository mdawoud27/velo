import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/queue.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [RealtimeModule, NotificationsModule, QueueModule, CloudinaryModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
