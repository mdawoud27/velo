import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { QueueModule } from 'src/queue/queue.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [QueueModule, RealtimeModule, NotificationsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
