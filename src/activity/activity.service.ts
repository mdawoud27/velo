import { Injectable } from '@nestjs/common';
import { CreateActivityDto } from './dtos';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  log(data: CreateActivityDto) {
    this.prisma.activityLog
      .create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          actorId: data.actorId,
          metadata: data.metadata ?? {},
          projectId: data.projectId,
          orgId: data.orgId,
        },
      })
      .catch((err: unknown) =>
        this.logger.error('Activity log failed:', err instanceof Error ? err : undefined, {
          service: 'ActivityService',
          ...(err instanceof Error ? {} : { err }),
        }),
      );
  }
}
