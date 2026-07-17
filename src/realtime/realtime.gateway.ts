import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsJwtGuard } from 'src/auth/guards';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { type AuthenticatedSocket, JwtPayload } from 'src/auth/interfaces';
import { JoinOrgDto, JoinTeamDto, JoinProjectDto } from './dtos';
import type { TaskEntity } from 'src/tasks/entities';
import type { Comment } from '@prisma/client';
import { TeamMemberEntity } from 'src/teams/entities';
import { ProjectMemberEntity } from 'src/projects/entities';

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true },
})
@UseGuards(WsJwtGuard)
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    server.use((socket: AuthenticatedSocket, next) => {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      try {
        socket.data.user = this.jwtService.verify<JwtPayload>(token);
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });

    this.logger.log('Realtime gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    await client.join(`user:${client.data.user.sub}`);

    client.on('disconnecting', () => {
      const userId = client.data.user.sub;
      for (const room of client.rooms) {
        if (room.startsWith('project:')) {
          client.to(room).emit('user:left', { userId });
        }
      }
    });

    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // room joins
  @SubscribeMessage('join:org')
  @UsePipes(new ValidationPipe())
  async handleJoinOrg(client: AuthenticatedSocket, data: JoinOrgDto) {
    await this.assertOrgMembership(client.data.user.sub, data.orgId);
    await client.join(`org:${data.orgId}`);
    client.emit('joined', { scope: 'org', orgId: data.orgId });
  }

  @SubscribeMessage('leave:org')
  @UsePipes(new ValidationPipe())
  async handleLeaveOrg(client: AuthenticatedSocket, data: JoinOrgDto) {
    await client.leave(`org:${data.orgId}`);
  }

  @SubscribeMessage('join:team')
  @UsePipes(new ValidationPipe())
  async handleJoinTeam(client: AuthenticatedSocket, data: JoinTeamDto) {
    await this.assertTeamMembership(client.data.user.sub, data.teamId);
    await client.join(`team:${data.teamId}`);
    client.emit('joined', { scope: 'team', teamId: data.teamId });
  }

  @SubscribeMessage('leave:team')
  @UsePipes(new ValidationPipe())
  async handleLeaveTeam(client: AuthenticatedSocket, data: JoinTeamDto) {
    await client.leave(`team:${data.teamId}`);
  }

  @SubscribeMessage('join:project')
  @UsePipes(new ValidationPipe())
  async handleJoinProject(client: AuthenticatedSocket, data: JoinProjectDto) {
    await this.assertProjectMembership(client.data.user.sub, data.projectId);
    await client.join(`project:${data.projectId}`);

    client.to(`project:${data.projectId}`).emit('user:joined', {
      userId: client.data.user.sub,
    });
    client.emit('joined', { scope: 'project', projectId: data.projectId });
  }

  @SubscribeMessage('leave:project')
  @UsePipes(new ValidationPipe())
  async handleLeaveProject(client: AuthenticatedSocket, data: JoinProjectDto) {
    await client.leave(`project:${data.projectId}`);
    client.to(`project:${data.projectId}`).emit('user:left', {
      userId: client.data.user.sub,
    });
  }

  // emit methods
  emitTaskCreated(projectId: string, task: TaskEntity) {
    this.server.to(`project:${projectId}`).emit('task:created', task);
  }
  emitTaskUpdated(projectId: string, task: TaskEntity) {
    this.server.to(`project:${projectId}`).emit('task:updated', task);
  }
  emitTaskDeleted(projectId: string, taskId: string) {
    this.server.to(`project:${projectId}`).emit('task:deleted', { taskId });
  }
  emitCommentAdded(projectId: string, comment: Comment) {
    this.server.to(`project:${projectId}`).emit('comment:added', comment);
  }

  emitProjectCreated(teamId: string, project: unknown) {
    this.server.to(`team:${teamId}`).emit('project:created', project);
  }
  emitProjectUpdated(projectId: string, project: unknown) {
    this.server.to(`project:${projectId}`).emit('project:updated', project);
  }
  emitProjectDeleted(teamId: string, projectId: string) {
    this.server.to(`team:${teamId}`).emit('project:deleted', { projectId });
  }

  emitTeamCreated(orgId: string, team: unknown) {
    this.server.to(`org:${orgId}`).emit('team:created', team);
  }
  emitTeamUpdated(teamId: string, team: unknown) {
    this.server.to(`team:${teamId}`).emit('team:updated', team);
  }

  emitOrgUpdated(orgId: string, org: unknown) {
    this.server.to(`org:${orgId}`).emit('org:updated', org);
  }

  emitOrgMemberAdded(orgId: string, member: { userId: string; role: string }) {
    this.server.to(`org:${orgId}`).emit('org:member_added', member);
  }

  emitTeamDeleted(orgId: string, teamId: string) {
    this.server.to(`org:${orgId}`).emit('team:deleted', { teamId });
  }

  emitProjectMemberAdded(projectId: string, member: ProjectMemberEntity) {
    this.server.to(`project:${projectId}`).emit('project:member_added', member);
  }
  emitProjectMemberRemoved(projectId: string, userId: string) {
    this.server.to(`project:${projectId}`).emit('project:member_removed', { userId });
  }

  emitTeamMemberAdded(teamId: string, member: TeamMemberEntity) {
    this.server.to(`team:${teamId}`).emit('team:member_added', member);
  }
  emitTeamMemberUpdated(teamId: string, member: TeamMemberEntity) {
    this.server.to(`team:${teamId}`).emit('team:member_updated', member);
  }
  emitTeamMemberRemoved(teamId: string, userId: string) {
    this.server.to(`team:${teamId}`).emit('team:member_removed', { userId });
  }

  // assignments, invites, mentions
  emitUserNotification(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  async disconnectUser(userId: string, reason = 'Account access revoked') {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      socket.emit('force-disconnect', { reason });
      socket.disconnect(true);
    }
  }

  async evictFromRoom(userId: string, room: string, reason: string) {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      if (socket.rooms.has(room)) {
        socket.leave(room);
        socket.emit('access-revoked', { room, reason });
      }
    }
  }

  // membership checks
  private async assertOrgMembership(userId: string, orgId: string): Promise<void> {
    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership) {
      throw new WsException('You are not a member of this organization');
    }
  }

  private async assertTeamMembership(userId: string, teamId: string): Promise<void> {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!membership) {
      throw new WsException('You are not a member of this team');
    }
  }

  private async assertProjectMembership(userId: string, projectId: string): Promise<void> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!membership) {
      throw new WsException('You are not a member of this project');
    }
  }
}
