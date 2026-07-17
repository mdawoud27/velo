import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
