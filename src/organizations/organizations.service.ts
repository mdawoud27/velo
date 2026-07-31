import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dtos/create-org.dto';
import {
  BannedUserException,
  DomainException,
  PlanLimitException,
  ResourceNotFoundException,
} from 'src/common/exceptions';
import { Organization, Plan, Prisma, User } from '@prisma/client';
import { OrgEntity } from './entities';
import { AcceptInviteDto, BulkInviteDto, DeclineInviteDto, InviteDto } from './dtos';
import { ConfigService } from '@nestjs/config';
import { buildPaginationMeta } from 'src/common/utils';
import { PaginationDto } from 'src/common/dtos';
import { ActivityService } from 'src/activity/activity.service';
import { CacheService } from 'src/cache/cache.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { LoggerService } from 'src/logger/logger.service';
import { EmailQueueService } from 'src/queue/services';

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
    private readonly cache: CacheService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly logger: LoggerService,
  ) {}

  async createOrganization(dto: CreateOrganizationDto, userId: string) {
    const org = await this.prisma.$transaction(async (tx) => {
      await this.findActiveUser(userId, tx);
      const org = await tx.organization.create({ data: dto });
      await tx.orgMember.create({ data: { orgId: org.id, userId, role: OrgRole.OWNER } });
      return new OrgEntity(org);
    });

    this.activity.log({
      action: 'org.created',
      entityType: 'Organization',
      entityId: org.id,
      actorId: userId,
      orgId: org.id,
    });

    void this.cache
      .invalidateUserCache(userId)
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to invalidate user cache',
          err instanceof Error ? err : undefined,
          OrganizationsService.name,
        ),
      );
    return new OrgEntity(org);
  }

  async inviteMember(orgId: string, dto: InviteDto, actorId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const actor = await this.findActiveUser(actorId, this.prisma);
    await this.assertActorCanManageMembers(orgId, actorId);

    await this.createInvitation(org, actor, dto, actorId);
  }

  async bulkInviteMembers(orgId: string, dto: BulkInviteDto, actorId: string) {
    // Batch-level checks run once. A missing org or an unauthorized actor
    // should surface as a real 404/403 for the whole request, not get
    // swallowed into a per-email "success: false".
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const actor = await this.findActiveUser(actorId, this.prisma);
    await this.assertActorCanManageMembers(orgId, actorId);

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of dto.emails) {
      try {
        await this.createInvitation(org, actor, { email, role: dto.role }, actorId);
        results.push({ email, success: true });
      } catch (err: unknown) {
        results.push({
          email,
          success: false,
          error: this.toSafeInviteErrorMessage(err),
        });
      }
    }

    return { results };
  }

  async resendInvite(orgId: string, dto: InviteDto, actorId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const actor = await this.findActiveUser(actorId, this.prisma);
    await this.assertActorCanManageMembers(orgId, actorId);

    const existingInvitation = await this.prisma.orgInvitation.findFirst({
      where: { orgId, email: dto.email },
      orderBy: { createdAt: 'desc' },
    });
    if (!existingInvitation) {
      throw new ResourceNotFoundException('Invitation', dto.email);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.orgInvitation.delete({ where: { id: existingInvitation.id } });
      await tx.orgInvitation.create({
        data: {
          orgId,
          email: dto.email,
          token,
          role: existingInvitation.role,
          invitedById: actorId,
          expiresAt,
        },
      });
    });

    await this.emailQueue.addInvitationEmail({
      to: dto.email,
      orgName: org.name,
      role: existingInvitation.role,
      inviterName: actor.name,
      invitationUrl: `${this.config.getOrThrow('FRONTEND_URL')}/accept-invite?token=${token}`,
      declineInvitationUrl: `${this.config.getOrThrow('FRONTEND_URL')}/decline-invite?token=${token}`,
    });

    this.activity.log({
      action: 'org.member.invited',
      entityType: 'Organization',
      entityId: orgId,
      actorId,
      orgId,
      metadata: { role: existingInvitation.role },
    });

    void this.cache.invalidateOrganizationCache(orgId).catch(() => {});
  }

  async acceptInvitation(orgId: string, dto: AcceptInviteDto, userId: string) {
    const invite = await this.prisma.orgInvitation.findUnique({
      where: { token: dto.token },
      include: { org: { select: { plan: true, deletedAt: true } } },
    });
    if (!invite) throw new ResourceNotFoundException('Invitation', dto.token);

    if (invite.orgId !== orgId) {
      throw new ResourceNotFoundException('Invitation', dto.token);
    }

    if (invite.org.deletedAt) {
      throw new DomainException(
        HttpStatus.GONE,
        'ORG_INACTIVE',
        'This organization is no longer active.',
      );
    }
    if (invite.expiresAt < new Date()) {
      throw new DomainException(HttpStatus.GONE, 'INVITE_EXPIRED', 'This invitation has expired.');
    }

    const user = await this.findActiveUser(userId);

    if (user.email !== invite.email) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'EMAIL_MISMATCH', 'Email does not match');
    }

    await this.prisma.$transaction(async (tx) => {
      const memberCount = await tx.orgMember.count({ where: { orgId: invite.orgId } });
      const limits: Record<Plan, number> = { FREE: 3, PRO: 20, BUSINESS: Infinity };

      if (memberCount >= limits[invite.org.plan]) {
        throw new PlanLimitException(
          `${invite.org.plan} plan is full. Upgrade to add more members.`,
        );
      }

      await tx.orgMember.create({
        data: { orgId: invite.orgId, userId, role: invite.role },
      });
      await tx.orgInvitation.delete({ where: { id: invite.id } });
    });

    this.activity.log({
      action: 'org.member.joined',
      entityType: 'Organization',
      entityId: invite.orgId,
      actorId: userId,
      orgId: invite.orgId,
      metadata: { role: invite.role },
    });

    void this.cache
      .invalidateOrganizationCache(orgId)
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to invalidate organization cache',
          err instanceof Error ? err : undefined,
          OrganizationsService.name,
        ),
      );
    void this.cache
      .invalidateUserCache(userId)
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to invalidate user cache',
          err instanceof Error ? err : undefined,
          OrganizationsService.name,
        ),
      );

    this.gateway.emitOrgMemberAdded(invite.orgId, { userId, role: invite.role });
  }

  async declineInvitation(orgId: string, dto: DeclineInviteDto, userId: string): Promise<void> {
    await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const invite = await this.prisma.orgInvitation.findUnique({
      where: { token: dto.token },
      include: { org: { select: { plan: true, deletedAt: true } } },
    });
    if (!invite) throw new ResourceNotFoundException('Invitation', dto.token);

    if (invite.orgId !== orgId) {
      throw new ResourceNotFoundException('Invitation', dto.token);
    }

    if (invite.org.deletedAt) {
      throw new DomainException(
        HttpStatus.GONE,
        'ORG_INACTIVE',
        'This organization is no longer active.',
      );
    }

    const user = await this.findActiveUser(userId);

    if (user.email !== invite.email) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'EMAIL_MISMATCH', 'Email does not match');
    }

    await this.prisma.orgInvitation.delete({ where: { token: dto.token } });

    this.activity.log({
      action: 'org.invitation.declined',
      entityType: 'Organization',
      entityId: orgId,
      actorId: userId,
      orgId,
    });

    void this.cache.invalidateOrganizationCache(orgId).catch(() => {});

    if (invite.invitedById !== userId) {
      void this.notifications
        .create({
          userId: invite.invitedById,
          type: 'org.invitation.declined',
          title: 'Your invitation was declined',
          body: `${invite.email} declined your invitation`,
          entityType: 'Organization',
          entityId: orgId,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send invitation-declined notification',
            err instanceof Error ? err : undefined,
            OrganizationsService.name,
          ),
        );
    }
  }

  async listInvitations(orgId: string, userId: string, dto: PaginationDto) {
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        userId_orgId: {
          orgId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    if (membership?.role !== OrgRole.OWNER && membership?.role !== OrgRole.ADMIN)
      throw new ForbiddenException('You are not authorized to perform this action');

    const [invitations, total] = await this.prisma.$transaction([
      this.prisma.orgInvitation.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          org: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orgInvitation.count({ where: { orgId } }),
    ]);

    return { meta: buildPaginationMeta(total, dto.page, dto.limit), data: invitations };
  }

  async getUserOrgs(userId: string, dto: PaginationDto) {
    const [orgs, total] = await this.prisma.$transaction([
      this.prisma.orgMember.findMany({
        where: { userId, org: { deletedAt: null } },
        select: {
          org: { select: { id: true, name: true, plan: true } },
        },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { org: { createdAt: 'desc' } },
      }),
      this.prisma.orgMember.count({ where: { userId } }),
    ]);

    return { meta: buildPaginationMeta(total, dto.page, dto.limit), data: orgs };
  }

  private async findActiveUser(userId: string, tx?: Prisma.TransactionClient): Promise<User> {
    const client = tx ?? this.prisma;
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User', userId);
    if (user.bannedAt) throw new BannedUserException();
    if (user.deletedAt) throw new ResourceNotFoundException('User', userId);
    return user;
  }

  private async assertActorCanManageMembers(orgId: string, actorId: string): Promise<void> {
    const actorMembership = await this.prisma.orgMember.findFirst({
      where: { userId: actorId, orgId, role: { in: [OrgRole.OWNER, OrgRole.ADMIN] } },
    });
    if (!actorMembership) {
      throw new ForbiddenException('You do not have permission to manage members.');
    }
  }

  private async assertNotAlreadyMember(orgId: string, email: string): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (!existingUser) throw new ResourceNotFoundException('User', email);

    await this.findActiveUser(existingUser.id, this.prisma);

    const alreadyMember = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId } },
    });
    if (alreadyMember) {
      throw new ConflictException('User is already a member of this organization.');
    }

    return existingUser;
  }

  private async createInvitation(org: Organization, actor: User, dto: InviteDto, actorId: string) {
    const invitedUser = await this.assertNotAlreadyMember(org.id, dto.email);

    const existingInvitation = await this.prisma.orgInvitation.findFirst({
      where: { orgId: org.id, email: dto.email, expiresAt: { gt: new Date() } },
    });
    if (existingInvitation) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const memberCount = await this.prisma.orgMember.count({ where: { orgId: org.id } });
    const limits: Record<Plan, number> = { FREE: 3, PRO: 20, BUSINESS: Infinity };
    if (memberCount >= limits[org.plan]) {
      throw new PlanLimitException(`${org.plan} plan is full. Upgrade to invite more.`);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.prisma.orgInvitation.create({
      data: {
        orgId: org.id,
        email: dto.email,
        token,
        role: dto.role ?? OrgRole.MEMBER,
        invitedById: actorId,
        expiresAt,
      },
    });

    try {
      await this.emailQueue.addInvitationEmail({
        to: dto.email,
        orgName: org.name,
        role: dto.role ?? OrgRole.MEMBER,
        inviterName: actor.name,
        invitationUrl: `${this.config.getOrThrow('FRONTEND_URL')}/accept-invite?token=${token}`,
        declineInvitationUrl: `${this.config.getOrThrow('FRONTEND_URL')}/decline-invite?token=${token}`,
      });
    } catch (err: unknown) {
      this.logger.error(
        'Failed to queue invitation email; invitation was still created',
        err instanceof Error ? err : undefined,
        OrganizationsService.name,
      );
    }

    this.activity.log({
      action: 'org.member.invited',
      entityType: 'Organization',
      entityId: org.id,
      actorId,
      orgId: org.id,
      metadata: { role: dto.role ?? OrgRole.MEMBER },
    });

    void this.cache.invalidateOrganizationCache(org.id).catch(() => {});

    if (invitedUser.id !== actorId) {
      void this.notifications
        .create({
          userId: invitedUser.id,
          type: 'org.invitation.received',
          title: 'You were invited to an organization',
          body: org.name,
          entityType: 'Organization',
          entityId: org.id,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send org invitation notification',
            err instanceof Error ? err : undefined,
            OrganizationsService.name,
          ),
        );
    }
  }

  private toSafeInviteErrorMessage(err: unknown): string {
    if (err instanceof HttpException) {
      return err.message;
    }
    this.logger.error(
      'Unexpected error during bulk invite',
      err instanceof Error ? err : undefined,
      OrganizationsService.name,
    );
    return 'Failed to invite this email due to an unexpected error';
  }
}
