import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CreateActivityDto } from './dtos';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggerService } from 'src/logger/logger.service';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';

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

  async listActivityLogs(params: {
    page: number;
    limit: number;
    orgId: string;
    projectId?: string;
    actorId?: string;
    entityType?: string;
    action?: string;
    requesterId: string;
  }) {
    await this.assertActorCanViewActivityLogs(params.orgId, params.projectId, params.requesterId);

    const where = {
      orgId: params.orgId,
      ...(params.projectId && { projectId: params.projectId }),
      ...(params.actorId && { actorId: params.actorId }),
      ...(params.entityType && { entityType: params.entityType }),
      ...(params.action && { action: { contains: params.action, mode: 'insensitive' as const } }),
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
        hasNextPage: params.page * params.limit < total,
        hasPreviousPage: params.page > 1,
      },
      data: logs,
    };
  }

  private async assertActorCanViewActivityLogs(
    orgId: string,
    projectId: string | undefined,
    requesterId: string,
  ): Promise<void> {
    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester) throw new ResourceNotFoundException('User', requesterId);
    if (requester.bannedAt) throw new BannedUserException();
    if (requester.deletedAt) throw new ResourceNotFoundException('User', requesterId);

    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: requesterId, orgId } },
    });
    if (!membership || (membership.role !== OrgRole.OWNER && membership.role !== OrgRole.ADMIN)) {
      throw new ForbiddenException(
        "You are not authorized to view this organization's activity logs",
      );
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null, team: { orgId, deletedAt: null } },
      });
      if (!project) throw new ResourceNotFoundException('Project', projectId);
    }
  }
}
