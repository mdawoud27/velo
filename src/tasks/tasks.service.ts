import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ActivityService } from 'src/activity/activity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateTaskDto,
  FilterTasksDto,
  SearchTasksDto,
  TagsMatchMode,
  TaskTagsDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dtos';
import { TaskEntity, TaskWithUsersEntity } from './entities';
import { OrgRole, Prisma, Task, TaskStatus, TeamRole, User } from '@prisma/client';
import {
  BannedUserException,
  InvalidTaskTransitionException,
  ResourceNotFoundException,
} from 'src/common/exceptions';
import { assertProjectWritable } from 'src/common/helpers/project-guard.helper';
import { buildPaginationMeta } from 'src/common/utils';
import { VALID_TRANSITIONS, USER_SUMMARY_SELECT } from './constants';
import { CacheService } from 'src/cache/cache.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly cache: CacheService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly logger: LoggerService,
  ) {}

  async createTask(
    orgId: string,
    teamId: string,
    projectId: string,
    dto: CreateTaskDto,
    actorId: string,
  ) {
    await this.assertActorCanManageTasks(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    await this.assertTaskTitleAvailable(projectId, dto.title);

    if (dto.assigneeId) {
      await this.assertUserIsProjectMember(dto.assigneeId, projectId);
    }
    if (dto.parentTaskId) {
      await this.getValidParentOrThrow(dto.parentTaskId, projectId);
    }

    const task = await this.prisma.task.create({
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        projectId,
        creatorId: actorId,
      },
    });

    this.activity.log({
      action: 'task.created',
      entityType: 'task',
      entityId: task.id,
      actorId,
      orgId,
      projectId,
      metadata: { title: task.title },
    });

    void this.cache.invalidateProjectCache(projectId).catch(() => {});

    const entity = new TaskEntity(task);

    this.gateway.emitTaskCreated(projectId, entity);

    if (task.assigneeId && task.assigneeId !== actorId) {
      void this.notifications
        .notify({
          userId: task.assigneeId,
          type: 'task.assigned',
          title: 'You were assigned a task',
          body: task.title,
          entityType: 'Task',
          entityId: task.id,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send task assignment notification',
            err instanceof Error ? err : undefined,
            TasksService.name,
          ),
        );
    }

    return entity;
  }

  async listTasks(
    orgId: string,
    teamId: string,
    projectId: string,
    dto: FilterTasksDto,
    actorId: string,
  ) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);

    const tagsFilter = dto.untaggedOnly
      ? { isEmpty: true }
      : dto.tags?.length
        ? dto.tagsMode === TagsMatchMode.ALL
          ? { hasEvery: dto.tags }
          : { hasSome: dto.tags } // default: ANY
        : undefined;

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(dto.status && { status: dto.status }),
      ...(dto.priority && { priority: dto.priority }),
      ...(dto.assigneeId && { assigneeId: dto.assigneeId }),
      ...(dto.creatorId && { creatorId: dto.creatorId }),
      ...(tagsFilter && { tags: tagsFilter }),
      ...(dto.search && {
        title: { contains: dto.search, mode: 'insensitive' },
      }),
      ...((dto.dueBefore || dto.dueAfter) && {
        dueDate: {
          ...(dto.dueBefore && { lte: new Date(dto.dueBefore) }),
          ...(dto.dueAfter && { gte: new Date(dto.dueAfter) }),
        },
      }),
      ...(dto.parentTaskId
        ? { parentTaskId: dto.parentTaskId }
        : dto.topLevelOnly
          ? { parentTaskId: null }
          : {}),
    };

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: {
          assignee: { select: USER_SUMMARY_SELECT },
          creator: { select: USER_SUMMARY_SELECT },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: tasks.map((task) => new TaskWithUsersEntity(task)),
    };
  }

  async getTask(taskId: string, projectId: string, teamId: string, orgId: string, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      include: {
        assignee: { select: USER_SUMMARY_SELECT },
        creator: { select: USER_SUMMARY_SELECT },
      },
    });
    if (!task) throw new ResourceNotFoundException('Task', taskId);

    return new TaskWithUsersEntity(task);
  }

  async updateTask(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    dto: UpdateTaskDto,
    actorId: string,
  ) {
    await this.assertActorCanManageTasks(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    const task = await this.getTaskOrThrow(taskId, projectId);

    if (dto.title && dto.title !== task.title) {
      await this.assertTaskTitleAvailable(projectId, dto.title, task.id);
    }
    if (dto.assigneeId) {
      await this.assertUserIsProjectMember(dto.assigneeId, projectId);
    }
    if (dto.parentTaskId) {
      await this.getValidParentOrThrow(dto.parentTaskId, projectId, taskId);
    }

    const newStatus = dto.status && dto.status !== task.status ? dto.status : undefined;
    const { ...rest } = dto;
    delete rest.status;

    if (newStatus) {
      this.assertValidTransition(task.status, newStatus);
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...rest,
        dueDate: dto.dueDate === null ? null : dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId && dto.assigneeId !== actorId) {
      void this.notifications
        .notify({
          userId: dto.assigneeId,
          type: 'task.assigned',
          title: 'You were assigned a task',
          body: updated.title,
          entityType: 'Task',
          entityId: updated.id,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send task update notification',
            err instanceof Error ? err : undefined,
            TasksService.name,
          ),
        );
    }

    if (Object.keys(rest).length > 0) {
      this.activity.log({
        action: 'task.updated',
        entityType: 'task',
        entityId: updated.id,
        actorId,
        orgId,
        projectId,
        metadata: { fields: Object.keys(rest) },
      });
      void this.cache.invalidateProjectCache(projectId).catch(() => {});
    }

    if (newStatus) {
      const final = await this.transitionStatus(updated, newStatus, actorId);
      void this.cache.invalidateTaskCache(taskId).catch(() => {});
      return new TaskEntity(final);
    }
    void this.cache.invalidateTaskCache(taskId).catch(() => {});

    const entity = new TaskEntity(updated);
    this.gateway.emitTaskUpdated(projectId, entity);
    return entity;
  }

  async updateStatus(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    dto: UpdateTaskStatusDto,
    actorId: string,
  ): Promise<Task> {
    await this.assertActorCanManageTasks(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    const task = await this.getTaskOrThrow(taskId, projectId);

    const updated = await this.transitionStatus(task, dto.status, actorId);

    const entity = new TaskEntity(updated);
    return entity;
  }

  async softDeleteTask(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    actorId: string,
  ) {
    await this.assertActorCanManageTasks(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);
    await this.getTaskOrThrow(taskId, projectId);

    const activeSubtasks = await this.prisma.task.count({
      where: { parentTaskId: taskId, deletedAt: null },
    });
    if (activeSubtasks > 0) {
      throw new ConflictException(
        'This task still has subtasks. Delete or reassign them before deleting this task.',
      );
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    this.activity.log({
      action: 'task.deleted',
      entityType: 'task',
      entityId: taskId,
      actorId,
      orgId,
      projectId,
    });

    await Promise.all([
      this.cache.invalidateTaskCache(taskId),
      this.cache.invalidateProjectCache(projectId),
    ]);

    this.gateway.emitTaskDeleted(projectId, taskId);
  }

  async addTags(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    dto: TaskTagsDto,
    actorId: string,
  ): Promise<TaskEntity> {
    await this.assertActorCanManageTasks(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    const task = await this.getTaskOrThrow(taskId, projectId);

    const incoming = [...new Set(dto.tags)];
    const newTags = incoming.filter((t) => !task.tags.includes(t));

    if (newTags.length === 0) {
      return new TaskEntity(task);
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { tags: { push: newTags } },
    });

    this.activity.log({
      action: 'task.tags.added',
      entityType: 'task',
      entityId: taskId,
      actorId,
      orgId,
      projectId,
      metadata: { tags: newTags },
    });

    void this.cache.invalidateTaskCache(taskId).catch(() => {});
    void this.cache.invalidateProjectCache(projectId).catch(() => {});

    const entity = new TaskEntity(updated);
    this.gateway.emitTaskUpdated(projectId, entity);
    return entity;
  }

  async removeTags(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    dto: TaskTagsDto,
    actorId: string,
  ): Promise<TaskEntity> {
    await this.assertActorCanManageTasks(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const task = await tx.task.findFirstOrThrow({
          where: { id: taskId, projectId, deletedAt: null },
        });

        const toRemove = new Set(dto.tags);
        const remaining = task.tags.filter((t) => !toRemove.has(t));

        if (remaining.length === task.tags.length) {
          return { task, updated: null as null | Task };
        }

        const updated = await tx.task.update({
          where: { id: taskId },
          data: { tags: remaining },
        });

        return { task, updated };
      },
      { isolationLevel: 'Serializable' },
    );

    if (!result.updated) {
      return new TaskEntity(result.task);
    }

    this.activity.log({
      action: 'task.tags.removed',
      entityType: 'task',
      entityId: taskId,
      actorId,
      orgId,
      projectId,
      metadata: { tags: dto.tags.filter((t) => result.task.tags.includes(t)) },
    });

    void this.cache.invalidateTaskCache(taskId).catch(() => {});
    void this.cache.invalidateProjectCache(projectId).catch(() => {});

    const entity = new TaskEntity(result.updated);
    this.gateway.emitTaskUpdated(projectId, entity);
    return entity;
  }

  async searchTasks(
    orgId: string,
    teamId: string,
    projectId: string,
    dto: SearchTasksDto,
    actorId: string,
  ) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);

    const limit = dto.limit;
    const offset = (dto.page - 1) * dto.limit;

    const tasks = await this.prisma.$queryRaw<Array<Task & { rank: number }>>`
    SELECT *,
      ts_rank(
        to_tsvector('english', "title" || ' ' || COALESCE("description", '')),
        plainto_tsquery('english', ${dto.query})
      ) AS rank
    FROM "Task"
    WHERE "projectId" = ${projectId}
      AND "deletedAt" IS NULL
      AND to_tsvector('english', "title" || ' ' || COALESCE("description", ''))
          @@ plainto_tsquery('english', ${dto.query})
    ORDER BY rank DESC, "createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint FROM "Task"
    WHERE "projectId" = ${projectId}
      AND "deletedAt" IS NULL
      AND to_tsvector('english', "title" || ' ' || COALESCE("description", ''))
          @@ plainto_tsquery('english', ${dto.query})
  `;

    const total = Number(countResult[0].count);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: tasks.map((task) => new TaskEntity(task)),
    };
  }

  async watchTask(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    actorId: string,
  ) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await this.getTaskOrThrow(taskId, projectId);

    await this.prisma.taskWatcher.upsert({
      where: { userId_taskId: { userId: actorId, taskId } },
      create: { userId: actorId, taskId },
      update: {},
    });

    return { watching: true };
  }

  async unwatchTask(
    taskId: string,
    projectId: string,
    teamId: string,
    orgId: string,
    actorId: string,
  ): Promise<void> {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await this.getTaskOrThrow(taskId, projectId);

    await this.prisma.taskWatcher.deleteMany({
      where: { userId: actorId, taskId },
    });
  }

  private async assertUserIsProjectMember(userId: string, projectId: string): Promise<void> {
    await this.findActiveUser(userId);

    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!membership) {
      throw new ForbiddenException('Assignee must be a member of this project');
    }
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

  private async assertActorCanManageTasks(
    orgId: string,
    teamId: string,
    projectId: string,
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

    const projectMembership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: actorId, projectId } },
    });
    if (projectMembership) {
      return;
    }

    throw new ForbiddenException('You do not have permission to manage tasks in this project');
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

  private async getValidParentOrThrow(
    parentTaskId: string,
    projectId: string,
    excludeTaskId?: string,
  ) {
    if (excludeTaskId && parentTaskId === excludeTaskId) {
      throw new ConflictException('A task cannot be its own parent');
    }

    const parent = await this.prisma.task.findFirst({
      where: { id: parentTaskId, projectId, deletedAt: null },
      select: { id: true, parentTaskId: true },
    });

    if (!parent) {
      throw new ResourceNotFoundException('Task', parentTaskId);
    }

    if (excludeTaskId) {
      let current = parent;
      const visited = new Set<string>();

      while (current.parentTaskId) {
        if (current.parentTaskId === excludeTaskId) {
          throw new ConflictException('That would create a circular task hierarchy');
        }

        if (visited.has(current.parentTaskId)) {
          throw new ConflictException('Circular task hierarchy detected');
        }

        visited.add(current.parentTaskId);

        const next = await this.prisma.task.findFirst({
          where: { id: current.parentTaskId, projectId, deletedAt: null },
          select: { id: true, parentTaskId: true },
        });

        if (!next) {
          break;
        }

        current = next;
      }
    }

    return parent;
  }

  private assertValidTransition(from: TaskStatus, to: TaskStatus): void {
    if (!VALID_TRANSITIONS[from].includes(to)) {
      throw new InvalidTaskTransitionException(from, to);
    }
  }

  private async getTaskOrThrow(taskId: string, projectId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
    });
    if (!task) throw new ResourceNotFoundException('Task', taskId);
    return task;
  }

  private async assertTaskTitleAvailable(projectId: string, title: string, excludeTaskId?: string) {
    const existing = await this.prisma.task.findFirst({
      where: {
        projectId,
        title,
        ...(excludeTaskId && {
          id: {
            not: excludeTaskId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException('A task with this title already exists.');
    }
  }

  private async checkAndCompleteParent(parentId: string, actorId = 'system'): Promise<void> {
    const completed = await this.prisma.$transaction((tx) =>
      this.tryAutoCompleteParent(tx, parentId, actorId),
    );

    void this.cache.invalidateTaskCache(parentId).catch(() => {});

    for (const t of completed) {
      void this.cache.invalidateTaskCache(t.id).catch(() => {});
      void this.cache.invalidateProjectCache(t.projectId).catch(() => {});
      this.gateway.emitTaskUpdated(t.projectId, new TaskEntity(t));
    }
  }

  private async tryAutoCompleteParent(
    tx: Prisma.TransactionClient,
    parentId: string,
    actorId: string,
  ): Promise<Task[]> {
    const parent = await tx.task.findUnique({ where: { id: parentId } });
    if (!parent || parent.deletedAt) return [];

    if (!VALID_TRANSITIONS[parent.status]?.includes(TaskStatus.DONE)) return [];

    const siblings = await tx.task.findMany({
      where: { parentTaskId: parentId, deletedAt: null },
      select: { status: true },
    });
    const allDone = siblings.length > 0 && siblings.every((s) => s.status === TaskStatus.DONE);
    if (!allDone) return [];

    const updated = await tx.task.update({
      where: { id: parentId },
      data: { status: TaskStatus.DONE, updatedAt: new Date() },
    });

    this.activity.log({
      action: 'task.status.auto-completed',
      entityType: 'Task',
      entityId: parentId,
      actorId,
      projectId: updated.projectId,
      metadata: { reason: 'all_subtasks_done', from: parent.status, to: updated.status },
    });

    // Cascade upward: completing this parent might complete its own parent
    const cascaded = updated.parentTaskId
      ? await this.tryAutoCompleteParent(tx, updated.parentTaskId, actorId)
      : [];

    return [updated, ...cascaded];
  }

  private async transitionStatus(
    task: Task,
    newStatus: TaskStatus,
    actorId: string,
  ): Promise<Task> {
    this.assertValidTransition(task.status, newStatus);

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { status: newStatus, updatedAt: new Date() },
    });

    this.activity.log({
      action: 'task.status.changed',
      entityType: 'Task',
      entityId: updated.id,
      actorId,
      projectId: task.projectId,
      metadata: { from: task.status, to: updated.status },
    });

    void this.cache.invalidateTaskCache(updated.id).catch(() => {});
    void this.cache.invalidateProjectCache(updated.projectId).catch(() => {});

    this.gateway.emitTaskUpdated(updated.projectId, new TaskEntity(updated));

    if (newStatus === TaskStatus.DONE && task.parentTaskId) {
      await this.checkAndCompleteParent(task.parentTaskId);
    }

    return updated;
  }
}
