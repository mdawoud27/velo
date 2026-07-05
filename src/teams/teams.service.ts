import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto, UpdateTeamMemberRoleDto } from './dtos';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { OrgRole, TeamRole, User } from '@prisma/client';
import { TeamEntity, TeamMemberEntity } from './entities';
import { buildPaginationMeta } from 'src/common/utils';
import { PaginationDto } from 'src/common/dtos';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTeam(orgId: string, dto: CreateTeamDto, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);

    const existingTeam = await this.prisma.team.findFirst({
      where: { orgId, name: dto.name, deletedAt: null },
    });

    if (existingTeam) throw new ConflictException('Team already exists');

    const team = await this.prisma.team.create({
      data: {
        ...dto,
        orgId,
      },
    });
    return new TeamEntity(team);
  }

  async getTeam(teamId: string, orgId: string, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, orgId, deletedAt: null },
    });
    if (!team) throw new ResourceNotFoundException('Team', teamId);
    return new TeamEntity(team);
  }

  async updateTeam(teamId: string, orgId: string, dto: UpdateTeamDto, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeam(teamId, orgId, actorId);

    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: dto,
    });
    return new TeamEntity(team);
  }

  async softDeleteTeam(teamId: string, orgId: string, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeam(teamId, orgId, actorId);

    await this.prisma.team.update({
      where: { id: teamId },
      data: { deletedAt: new Date() },
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
    const team = await this.getTeam(teamId, orgId, actorId);

    await this.findActiveUser(dto.userId);

    // Ensure the target user is part of the org
    const orgMember = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: dto.userId, orgId: team.orgId } },
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
    await this.getTeam(teamId, orgId, actorId);

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

    return new TeamMemberEntity(member);
  }

  async removeMember(teamId: string, orgId: string, userId: string, actorId: string) {
    await this.assertActorCanManageTeams(orgId, actorId);
    await this.getTeam(teamId, orgId, actorId);

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!existingMember) {
      throw new ResourceNotFoundException('TeamMember', userId);
    }

    await this.prisma.teamMember.delete({
      where: { userId_teamId: { userId, teamId } },
    });
  }

  async listMembers(teamId: string, orgId: string, dto: PaginationDto, actorId: string) {
    await this.assertActorIsOrgMember(orgId, actorId);
    await this.getTeam(teamId, orgId, actorId);

    const [members, total] = await this.prisma.$transaction([
      this.prisma.teamMember.findMany({
        where: { teamId },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { role: 'asc' },
      }),
      this.prisma.teamMember.count({ where: { teamId } }),
    ]);

    return {
      meta: buildPaginationMeta(total, dto.page, dto.limit),
      data: members.map((member) => new TeamMemberEntity(member)),
    };
  }

  private async findActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User', userId);
    if (!user.isEmailVerified) throw new BadRequestException('User email not verified');
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
}
