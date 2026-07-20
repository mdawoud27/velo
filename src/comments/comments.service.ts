import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole, Comment, TeamRole, User, Task } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityService } from 'src/activity/activity.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { CreateCommentDto, UpdateCommentDto } from './dtos';
import { CommentEntity } from './entities';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { assertProjectWritable } from 'src/common/helpers/project-guard.helper';
import { buildPaginationMeta } from 'src/common/utils';
import { PaginationDto } from 'src/common/dtos';
import { USER_SUMMARY_SELECT } from 'src/tasks/constants';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async createComment(
    orgId: string,
    teamId: string,
    projectId: string,
    taskId: string,
    dto: CreateCommentDto,
    actorId: string,
  ): Promise<CommentEntity> {
    await this.assertActorCanManageComments(orgId, teamId, projectId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);

    const task = await this.getTaskOrThrow(taskId, projectId);

    const comment = await this.prisma.comment.create({
      data: {
        body: dto.body,
        taskId,
        authorId: actorId,
      },
      include: {
        author: { select: USER_SUMMARY_SELECT },
      },
    });

    this.activity.log({
      action: 'comment.created',
      entityType: 'Task',
      entityId: taskId,
      actorId,
      orgId,
      projectId,
      metadata: { commentId: comment.id },
    });

    const entity = new CommentEntity(comment);
    this.gateway.emitCommentAdded(projectId, comment);

    await this.notifyCommentAdded(entity, task, actorId, projectId);

    return entity;
  }

  async listComments(
    orgId: string,
    teamId: string,
    projectId: string,
    taskId: string,
    dto: PaginationDto,
    actorId: string,
  ) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await this.getTaskOrThrow(taskId, projectId);

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: { taskId, deletedAt: null },
        include: {
          author: { select: USER_SUMMARY_SELECT },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.comment.count({ where: { taskId, deletedAt: null } }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: comments.map((comment) => new CommentEntity(comment)),
    };
  }

  async updateComment(
    orgId: string,
    teamId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
    actorId: string,
  ): Promise<CommentEntity> {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);
    await this.getTaskOrThrow(taskId, projectId);

    const comment = await this.getCommentOrThrow(commentId, taskId);

    if (comment.authorId !== actorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: {
        author: { select: USER_SUMMARY_SELECT },
      },
    });

    return new CommentEntity(updated);
  }

  async deleteComment(
    orgId: string,
    teamId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    actorId: string,
  ): Promise<void> {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getProjectOrThrow(projectId, teamId, orgId);
    await assertProjectWritable(this.prisma, projectId);
    await this.getTaskOrThrow(taskId, projectId);

    const comment = await this.getCommentOrThrow(commentId, taskId);

    if (comment.authorId !== actorId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  private async notifyCommentAdded(
    comment: CommentEntity,
    task: Task,
    authorId: string,
    projectId: string,
  ): Promise<void> {
    const recipientSet = new Set<string>();

    // 1. Task creator
    if (task.creatorId) {
      recipientSet.add(task.creatorId);
    }

    // 2. Every distinct previous commenter on this task
    const previousCommenters = await this.prisma.comment.findMany({
      where: { taskId: task.id, authorId: { not: authorId }, deletedAt: null },
      select: { authorId: true },
      distinct: ['authorId'],
    });
    previousCommenters.forEach((c) => recipientSet.add(c.authorId));

    // 3. Every task watcher
    const watchers = await this.prisma.taskWatcher.findMany({
      where: { taskId: task.id },
      select: { userId: true },
    });
    watchers.forEach((w) => recipientSet.add(w.userId));

    // Never notify the author of their own comment
    recipientSet.delete(authorId);

    // Send notifications to the recipientSet
    if (recipientSet.size > 0) {
      const authorName = comment.author?.name || 'Someone';
      const notifications = Array.from(recipientSet).map((userId) => ({
        userId,
        type: 'COMMENT_ADDED',
        title: 'New comment on a task',
        body: `${authorName} commented on "${task.title}"`,
        entityType: 'Comment',
        entityId: comment.id,
      }));
      await this.notifications.createBulk(notifications);
    }

    // @mentions handling
    const mentionedUsernames = this.extractMentions(comment.body);
    if (mentionedUsernames.length > 0) {
      await this.processMentions(mentionedUsernames, comment, task, authorId, projectId);
    }
  }

  private extractMentions(body: string): string[] {
    const regex = /@([a-zA-Z0-9_]+)/g;
    const matches = [...body.matchAll(regex)];
    return [...new Set(matches.map((m) => m[1]))]; // deduplicated
  }

  private async processMentions(
    usernames: string[],
    comment: CommentEntity,
    task: Task,
    authorId: string,
    projectId: string,
  ) {
    // Find the mentioned users who are project members
    const users = await this.prisma.user.findMany({
      where: {
        name: { in: usernames },
        projectMemberships: { some: { projectId } },
        deletedAt: null,
        bannedAt: null,
      },
    });

    const authorName = comment.author?.name || 'Someone';

    const notifications = users
      .filter((u) => u.id !== authorId) // don't notify yourself
      .map((u) => ({
        userId: u.id,
        type: 'MENTION',
        title: 'You were mentioned',
        body: `${authorName} mentioned you in a comment`,
        entityType: 'Comment',
        entityId: comment.id,
      }));

    if (notifications.length > 0) {
      await this.notifications.createBulk(notifications);
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

  private async assertActorCanManageComments(
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

    throw new ForbiddenException('You do not have permission to manage comments in this project');
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

  private async getTaskOrThrow(taskId: string, projectId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
    });
    if (!task) throw new ResourceNotFoundException('Task', taskId);
    return task;
  }

  private async getCommentOrThrow(commentId: string, taskId: string): Promise<Comment> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
    });
    if (!comment) throw new ResourceNotFoundException('Comment', commentId);
    return comment;
  }
}
