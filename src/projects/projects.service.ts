import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole, Prisma, ProjectStatus, TeamRole, User } from '@prisma/client';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateProjectDto,
  ListProjectsDto,
  ProjectMemberDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dtos';
import { ProjectEntity, ProjectMemberEntity } from './entities';
import { buildPaginationMeta } from 'src/common/utils';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(orgId: string, teamId: string, dto: CreateProjectDto, actorId: string) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await this.getTeamOrThrow(teamId, orgId);

    const project = await this.prisma.project.create({
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        teamId,
      },
    });

    return new ProjectEntity(project);
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
    return new ProjectEntity(await this.getProjectOrThrow(projectId, teamId));
  }

  async updateProject(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: UpdateProjectDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await this.getProjectOrThrow(projectId, teamId);

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });

    return new ProjectEntity(project);
  }

  async updateProjectStatus(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: UpdateProjectStatusDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    const project = await this.getProjectOrThrow(projectId, teamId);

    if (project.status === dto.status) {
      throw new ConflictException(`Project is already ${dto.status.toLowerCase()}`);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: dto.status },
    });

    return new ProjectEntity(updated);
  }

  async softDeleteProject(projectId: string, teamId: string, orgId: string, actorId: string) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    const project = await this.getProjectOrThrow(projectId, teamId);

    if (project.status !== ProjectStatus.ARCHIVED) {
      throw new ConflictException(
        'Only archived projects can be deleted. Archive the project first.',
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }

  async addMember(
    projectId: string,
    teamId: string,
    orgId: string,
    dto: ProjectMemberDto,
    actorId: string,
  ) {
    await this.assertActorCanManageProjects(orgId, teamId, actorId);
    await this.getProjectOrThrow(projectId, teamId);
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

    const member = await this.prisma.projectMember.create({
      data: { userId: dto.userId, projectId },
    });

    return new ProjectMemberEntity(member);
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

  private async getProjectOrThrow(projectId: string, teamId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId, deletedAt: null },
    });
    if (!project) throw new ResourceNotFoundException('Project', projectId);
    return project;
  }
}
