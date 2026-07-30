import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  OrgRole,
  Prisma,
  ProjectMember,
  ProjectStatus,
  TaskStatus,
  TeamRole,
  User,
} from '@prisma/client';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateProjectDto,
  ListProjectsDto,
  ProjectMemberDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dtos';
import { ProjectEntity, ProjectMemberEntity, ProjectMemberWithUserEntity } from './entities';
import { buildPaginationMeta } from 'src/common/utils';
import { PaginationDto } from 'src/common/dtos';
import { assertProjectWritable } from 'src/common/helpers/project-guard.helper';
import { ActivityService } from 'src/activity/activity.service';
import { CacheService } from 'src/cache/cache.service';
import { RedisService } from 'src/redis/redis.service';
import { KanbanBoard, ProjectSummary } from './interfaces';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { LoggerService } from 'src/logger/logger.service';
import { RealtimeEvictionQueueService } from 'src/queue/services';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly logger: LoggerService,
    private readonly realtimeEvictionQueue: RealtimeEvictionQueueService,
  ) {}

  async createProject(orgId: string, teamId: string, dto: CreateProjectDto, actorId: string) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    const existingProject = await this.prisma.project.findFirst({
      where: { teamId, name: dto.name, deletedAt: null },
    });
    if (existingProject) {
      throw new ConflictException('Project already exists');
    }

    const project = await this.prisma.project.create({
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        teamId,
      },
    });

    this.activity.log({
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      actorId,
      orgId,
      projectId: project.id,
    });

    void this.cache.invalidateTeamCache(teamId).catch(() => {});

    const entity = new ProjectEntity(project);
    this.gateway.emitProjectCreated(teamId, entity);
    return entity;
  }

  async listProjects(orgId: string, teamId: string, dto: ListProjectsDto, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    const where: Prisma.ProjectWhereInput = {
      teamId,
      deletedAt: null,
      ...(dto.status && { status: dto.status }),
    };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: projects.map((project) => new ProjectEntity(project)),
    };
  }

  async getProject(projectId: string, teamId: string, orgId: string, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);
    return new ProjectEntity(await this.getProjectOrThrow(projectId, teamId, orgId));
  }

  async updateProject(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: UpdateProjectDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...dto,
        deadline: dto.deadline === null ? null : dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });

    this.activity.log({
      action: 'project.updated',
      entityType: 'project',
      entityId: project.id,
      actorId,
      orgId,
      projectId: project.id,
      metadata: { fields: Object.keys(dto) },
    });

    await Promise.all([
      this.cache.invalidateProjectCache(project.id),
      this.cache.invalidateTeamCache(teamId),
    ]);

    const entity = new ProjectEntity(project);
    this.gateway.emitProjectUpdated(project.id, entity);
    return entity;
  }

  async updateProjectStatus(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: UpdateProjectStatusDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await assertProjectWritable(this.prisma, projectId);

    const project = await this.getProjectOrThrow(projectId, teamId, orgId);

    if (project.status === dto.status) {
      throw new ConflictException(`Project is already ${dto.status.toLowerCase()}`);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: dto.status },
    });

    this.activity.log({
      action: 'project.updated',
      entityType: 'project',
      entityId: updated.id,
      actorId,
      orgId,
      projectId: updated.id,
      metadata: {
        field: 'status',
        from: project.status,
        to: updated.status,
      },
    });

    await Promise.all([
      this.cache.invalidateProjectCache(updated.id),
      this.cache.invalidateTeamCache(teamId),
    ]);

    const entity = new ProjectEntity(updated);
    this.gateway.emitProjectUpdated(updated.id, entity);
    return entity;
  }

  async softDeleteProject(projectId: string, teamId: string, orgId: string, actorId: string) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await assertProjectWritable(this.prisma, projectId);

    const project = await this.getProjectOrThrow(projectId, teamId, orgId);

    if (project.status !== ProjectStatus.ARCHIVED) {
      throw new ConflictException(
        'Only archived projects can be deleted. Archive the project first.',
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.project.update({
        where: { id: projectId },
        data: { deletedAt: now },
      }),
      this.prisma.task.updateMany({
        where: { projectId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    this.activity.log({
      action: 'project.deleted',
      entityType: 'project',
      entityId: project.id,
      actorId,
      orgId,
      projectId: project.id,
    });

    await Promise.all([
      this.cache.invalidateProjectCache(project.id),
      this.cache.invalidateTeamCache(teamId),
    ]);

    this.gateway.emitProjectDeleted(teamId, project.id);
  }

  async addMember(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: ProjectMemberDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await assertProjectWritable(this.prisma, projectId);

    const project = await this.getProjectOrThrow(projectId, teamId, orgId);
    await this.findActiveUser(dto.userId);

    const teamMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: dto.userId, teamId } },
    });
    if (!teamMembership) {
      throw new ForbiddenException('User must be a member of the team to join this project');
    }

    const existingMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: dto.userId, projectId } },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this project');
    }

    let member: ProjectMember;
    try {
      member = await this.prisma.projectMember.create({
        data: { userId: dto.userId, projectId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('User is already a member of this project');
      }
      throw err;
    }

    this.activity.log({
      action: 'project.member.added',
      entityType: 'projectMember',
      entityId: member.id,
      actorId,
      orgId,
      projectId,
      metadata: {
        userId: dto.userId,
      },
    });

    void this.cache.invalidateProjectCache(projectId).catch(() => {});

    const entity = new ProjectMemberEntity(member);
    this.gateway.emitProjectMemberAdded(projectId, entity);

    if (dto.userId !== actorId) {
      void this.notifications
        .create({
          userId: dto.userId,
          type: 'project.member_added',
          title: 'You were added to a project',
          body: project.name,
          entityType: 'Project',
          entityId: projectId,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send project membership notification',
            err instanceof Error ? err : undefined,
            ProjectsService.name,
          ),
        );
    }

    return entity;
  }

  async listMembers(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: PaginationDto,
    actorId: string,
  ) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);

    const [members, total] = await this.prisma.$transaction([
      this.prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.projectMember.count({ where: { projectId } }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: members.map((member) => new ProjectMemberWithUserEntity(member)),
    };
  }

  async removeMember(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: ProjectMemberDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await assertProjectWritable(this.prisma, projectId);

    const project = await this.getProjectOrThrow(projectId, teamId, orgId);

    let deletedMember: ProjectMember;
    try {
      deletedMember = await this.prisma.projectMember.delete({
        where: { userId_projectId: { userId: dto.userId, projectId } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ResourceNotFoundException('ProjectMember', dto.userId);
      }
      throw err;
    }

    this.activity.log({
      action: 'project.member.removed',
      entityType: 'projectMember',
      entityId: deletedMember.id,
      actorId,
      orgId,
      projectId,
      metadata: {
        userId: dto.userId,
      },
    });

    await Promise.all([
      this.cache.invalidateProjectCache(projectId),
      this.cache.invalidateUserCache(dto.userId),
    ]);

    this.gateway.emitProjectMemberRemoved(projectId, dto.userId);
    void this.realtimeEvictionQueue
      .enqueueEviction({
        userId: dto.userId,
        room: `project:${projectId}`,
        reason: 'Removed from project',
      })
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to queue eviction job',
          err instanceof Error ? err : undefined,
          ProjectsService.name,
        ),
      );

    if (dto.userId !== actorId) {
      void this.notifications
        .create({
          userId: dto.userId,
          type: 'project.member_removed',
          title: 'You were removed from a project',
          body: project.name,
          entityType: 'Project',
          entityId: projectId,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send project membership notification',
            err instanceof Error ? err : undefined,
            ProjectsService.name,
          ),
        );
    }
  }

  async getBoard(
    projectId: string,
    teamId: string,
    orgId: string,
    actorId: string,
  ): Promise<KanbanBoard> {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const board: KanbanBoard = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };

    for (const task of tasks) {
      board[task.status].push(task);
    }

    return board;
  }

  async getSummary(
    projectId: string,
    teamId: string,
    orgId: string,
    actorId: string,
  ): Promise<ProjectSummary> {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);

    const now = new Date();

    const statusCountsQuery = this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      orderBy: { status: 'asc' },
      _count: true,
    });

    const overdueCountQuery = this.prisma.task.count({
      where: {
        projectId,
        deletedAt: null,
        dueDate: { lt: now },
        status: { not: TaskStatus.DONE },
      },
    });

    const [statusCounts, overdueCount] = await this.prisma.$transaction([
      statusCountsQuery,
      overdueCountQuery,
    ]);

    const summary: ProjectSummary = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      overdue: overdueCount,
    };

    for (const row of statusCounts) {
      summary[row.status] = row._count;
    }

    return summary;
  }

  private async findActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User', userId);
    if (user.bannedAt) throw new BannedUserException();
    if (user.deletedAt) throw new ResourceNotFoundException('User', userId);
    return user;
  }

  private async findActiveOrg(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) {
      throw new ResourceNotFoundException('Organization', orgId);
    }
  }

  private async assertActorCanManageProjects(
    orgId: string,
    teamId: string,
    actorId: string,
  ): Promise<void> {
    await this.findActiveOrg(orgId);
    await this.findActiveUser(actorId);

    const orgMembership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: actorId, orgId } },
    });
    if (
      orgMembership &&
      (orgMembership.role === OrgRole.OWNER || orgMembership.role === OrgRole.ADMIN)
    ) {
      return;
    }

    const teamMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: actorId, teamId } },
    });
    if (teamMembership && teamMembership.role === TeamRole.LEAD) {
      return;
    }

    throw new ForbiddenException('You do not have permission to manage projects in this team');
  }

  private async getTeamOrThrow(teamId: string, orgId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, orgId, deletedAt: null },
    });
    if (!team) throw new ResourceNotFoundException('Team', teamId);
    return team;
  }

  private async assertActorIsOrgMember(orgId: string, actorId: string): Promise<void> {
    await this.findActiveOrg(orgId);
    await this.findActiveUser(actorId);

    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: actorId, orgId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }

  private async getProjectOrThrow(projectId: string, teamId: string, orgId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        teamId,
        deletedAt: null,
        team: { orgId, deletedAt: null },
      },
    });
    if (!project) throw new ResourceNotFoundException('Project', projectId);
    return project;
  }
}
