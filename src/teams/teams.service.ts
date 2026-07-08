import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto, UpdateTeamMemberRoleDto } from './dtos';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { OrgRole, TeamRole, User } from '@prisma/client';
import { TeamEntity, TeamMemberEntity, TeamMemberWithUserEntity } from './entities';
import { buildPaginationMeta } from 'src/common/utils';
import { PaginationDto } from 'src/common/dtos';
import { ActivityService } from 'src/activity/activity.service';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async createTeam(orgId: string, dto: CreateTeamDto, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);

    const team = await this.prisma.team.create({
      data: {
        ...dto,
        orgId,
      },
    });

    this.activity.log({
      action: 'team.created',
      entityType: 'Team',
      entityId: team.id,
      actorId,
      orgId,
      metadata: { name: team.name },
    });

    return new TeamEntity(team);
  }

  async getTeam(teamId: string, orgId: string, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);
    return new TeamEntity(await this.getTeamOrThrow(teamId, orgId));
  }

  async updateTeam(teamId: string, orgId: string, dto: UpdateTeamDto, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: dto,
    });

    this.activity.log({
      action: 'team.updated',
      entityType: 'Team',
      entityId: teamId,
      actorId,
      orgId,
      metadata: { fields: Object.keys(dto) },
    });

    return new TeamEntity(team);
  }

  async softDeleteTeam(teamId: string, orgId: string, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    await this.prisma.team.update({
      where: { id: teamId },
      data: { deletedAt: new Date() },
    });

    this.activity.log({
      action: 'team.deleted',
      entityType: 'Team',
      entityId: teamId,
      actorId,
      orgId,
    });
  }

  async listTeams(orgId: string, dto: PaginationDto, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);

    const [teams, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({
        where: { orgId, deletedAt: null },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.team.count({ where: { orgId, deletedAt: null } }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: teams.map((team) => new TeamEntity(team)),
    };
  }

  async addMember(teamId: string, orgId: string, dto: AddTeamMemberDto, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    await this.findActiveUser(dto.userId);

    const orgMember = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: dto.userId, orgId } },
    });

    if (!orgMember) {
      throw new ForbiddenException('User is not a member of the organization');
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: dto.userId, teamId } },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    const member = await this.prisma.teamMember.create({
      data: {
        userId: dto.userId,
        teamId,
        role: dto.role ?? TeamRole.MEMBER,
      },
    });

    this.activity.log({
      action: 'team.member.added',
      entityType: 'Team',
      entityId: teamId,
      actorId,
      orgId,
      metadata: { userId: dto.userId, role: dto.role },
    });

    return new TeamMemberEntity(member);
  }

  async updateMemberRole(
    teamId: string,
    orgId: string,
    userId: string,
    dto: UpdateTeamMemberRoleDto,
    actorId: string,
  ) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    await this.findActiveUser(userId);

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!existingMember) {
      throw new ResourceNotFoundException('TeamMember', userId);
    }

    const member = await this.prisma.teamMember.update({
      where: { userId_teamId: { userId, teamId } },
      data: { role: dto.role },
    });

    this.activity.log({
      action: 'team.member.role_updated',
      entityType: 'Team',
      entityId: teamId,
      actorId,
      orgId,
      metadata: { userId, role: dto.role },
    });

    return new TeamMemberEntity(member);
  }

  async removeMember(teamId: string, orgId: string, userId: string, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!existingMember) {
      throw new ResourceNotFoundException('TeamMember', userId);
    }

    await this.prisma.teamMember.delete({
      where: { userId_teamId: { userId, teamId } },
    });

    this.activity.log({
      action: 'team.member.removed',
      entityType: 'Team',
      entityId: teamId,
      actorId,
      orgId,
      metadata: { userId },
    });
  }

  async listMembers(teamId: string, orgId: string, dto: PaginationDto, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    const [members, total] = await this.prisma.$transaction([
      this.prisma.teamMember.findMany({
        where: { teamId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { role: 'asc' },
      }),
      this.prisma.teamMember.count({ where: { teamId } }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: members.map((member) => new TeamMemberWithUserEntity(member)),
    };
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

  private async assertActorCanManageTeams(orgId: string, actorId: string): Promise<void> {
    await this.findActiveOrg(orgId);
    await this.findActiveUser(actorId);

    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: actorId, orgId } },
    });

    if (!membership || (membership.role !== OrgRole.OWNER && membership.role !== OrgRole.ADMIN)) {
      throw new ForbiddenException(
        'You do not have permission to manage teams in this organization',
      );
    }
  }

  private async getTeamOrThrow(teamId: string, orgId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, orgId, deletedAt: null },
    });
    if (!team) throw new ResourceNotFoundException('Team', teamId);
    return team;
  }
}
