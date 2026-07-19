import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { CreateNotificationDto } from './dtos';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async create(data: CreateNotificationDto): Promise<void> {
    const notification = await this.prisma.notification.create({ data });
    this.gateway.emitNotification(data.userId, notification);
  }

  async createBulk(notifications: CreateNotificationDto[]): Promise<void> {
    const created = await this.prisma.notification.createManyAndReturn({ data: notifications });
    created.forEach((n) => {
      this.gateway.emitNotification(n.userId, n);
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
