import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ActivityService } from 'src/activity/activity.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dtos';
import { TaskEntity } from './entities';
import { OrgRole, TeamRole, User } from '@prisma/client';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { assertProjectWritable } from 'src/common/helpers/project-guard.helper';

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

  private async assertUserIsProjectMember(userId: string, projectId: string): Promise<void> {
    await this.findActiveUser(userId);

    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!membership) {
      throw new ForbiddenException('Assignee must be a member of this project');
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
}
