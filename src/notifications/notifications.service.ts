import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import type { NotifyParams } from './interfaces';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async notify(params: NotifyParams) {
    const notification = await this.prisma.notification.create({ data: params });
    this.gateway.emitUserNotification(params.userId, notification);
    return notification;
  }

  async notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return [];
    const notifications = await this.prisma.notification.createManyAndReturn({
      data: unique.map((userId) => ({ ...params, userId })),
    });

    for (const notification of notifications) {
      this.gateway.emitUserNotification(notification.userId, notification);
    }
    return notifications;
  }
}
