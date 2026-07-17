import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [RealtimeModule, NotificationsModule, QueueModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
