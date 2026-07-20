import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
