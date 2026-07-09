import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ActivityService } from 'src/activity/activity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto, FilterTasksDto, UpdateTaskDto } from './dtos';
import { TaskEntity, TaskWithUsersEntity } from './entities';
import { OrgRole, Prisma, Task, TaskStatus, TeamRole, User } from '@prisma/client';
import {
  BannedUserException,
  InvalidTaskTransitionException,
  ResourceNotFoundException,
} from 'src/common/exceptions';
import { assertProjectWritable } from 'src/common/helpers/project-guard.helper';
import { buildPaginationMeta } from 'src/common/utils';

const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: [TaskStatus.IN_PROGRESS],
  IN_PROGRESS: [TaskStatus.TODO, TaskStatus.IN_REVIEW],
  IN_REVIEW: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  DONE: [TaskStatus.IN_PROGRESS],
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
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

    return new TaskEntity(task);
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

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(dto.status && { status: dto.status }),
      ...(dto.priority && { priority: dto.priority }),
      ...(dto.assigneeId && { assigneeId: dto.assigneeId }),
      ...(dto.creatorId && { creatorId: dto.creatorId }),
      ...(dto.tags?.length && { tags: { hasSome: dto.tags } }),
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

    if (dto.status && dto.status !== task.status) {
      this.assertValidTransition(task.status, dto.status);
    }
    if (dto.assigneeId) {
      await this.assertUserIsProjectMember(dto.assigneeId, projectId);
    }
    if (dto.parentTaskId) {
      await this.getValidParentOrThrow(dto.parentTaskId, projectId, taskId);
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueDate: dto.dueDate === null ? null : dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    this.activity.log({
      action: 'task.updated',
      entityType: 'task',
      entityId: updated.id,
      actorId,
      orgId,
      projectId,
      metadata:
        dto.status && dto.status !== task.status
          ? { field: 'status', from: task.status, to: updated.status }
          : { fields: Object.keys(dto) },
    });

    return new TaskEntity(updated);
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
    });
    if (!parent) throw new ResourceNotFoundException('Task', parentTaskId);

    if (excludeTaskId && parent.parentTaskId === excludeTaskId) {
      throw new ConflictException('That task is already a subtask of this task');
    }

    return parent;
  }

  private assertValidTransition(from: TaskStatus, to: TaskStatus): void {
    if (!STATUS_TRANSITIONS[from].includes(to)) {
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
}
