import { forwardRef, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
