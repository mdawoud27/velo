import { ConflictException, ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dtos/create-org.dto';
import {
  BannedUserException,
  DomainException,
  PlanLimitException,
  ResourceNotFoundException,
} from 'src/common/exceptions';
import { Plan, Prisma, User } from '@prisma/client';
import { OrgEntity } from './entities';
import { AcceptInviteDto, DeclineInviteDto, InviteDto } from './dtos';
import { EmailQueueService } from 'src/queue/email-queue.service';
import { ConfigService } from '@nestjs/config';

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
  ) {}

  async createOrganization(dto: CreateOrganizationDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.findActiveUser(userId, tx);

      const org = await tx.organization.create({ data: dto });
      await tx.orgMember.create({ data: { orgId: org.id, userId, role: OrgRole.OWNER } });
      return new OrgEntity(org);
    });
  }

  async inviteMember(orgId: string, dto: InviteDto, actorId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const actor = await this.findActiveUser(actorId, this.prisma);

    const actorMembership = await this.prisma.orgMember.findFirst({
      where: {
        userId: actorId,
        orgId,
        role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
      },
    });

    if (!actorMembership) {
      throw new ForbiddenException(
        'You do not have permission to invite members to this organization.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!existingUser) {
      throw new ResourceNotFoundException('User', dto.email);
    }

    await this.findActiveUser(existingUser.id, this.prisma);

    if (existingUser) {
      const alreadyMember = await this.prisma.orgMember.findUnique({
        where: {
          userId_orgId: {
            userId: existingUser.id,
            orgId,
          },
        },
      });

      if (alreadyMember) {
        throw new ConflictException('User is already a member of this organization.');
      }
    }

    const existingInvitation = await this.prisma.orgInvitation.findFirst({
      where: {
        orgId,
        email: dto.email,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const memberCount = await this.prisma.orgMember.count({ where: { orgId } });
    const limits: Record<Plan, number> = { FREE: 3, PRO: 20, BUSINESS: Infinity };

    if (memberCount >= limits[org.plan]) {
      throw new PlanLimitException(
        `${org.plan} plan allows up to ${limits[org.plan]} members. Upgrade to invite more.`,
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.prisma.orgInvitation.create({
      data: {
        orgId,
        email: dto.email,
        token,
        role: dto.role ?? OrgRole.MEMBER,
        invitedById: actorId,
        expiresAt,
      },
    });

    await this.emailQueue.addInvitationEmail({
      to: dto.email,
      orgName: org.name,
      role: dto.role ?? OrgRole.MEMBER,
      inviterName: actor.name,
      invitationUrl: `${this.config.getOrThrow('FRONTEND_URL')}/accept-invite?token=${token}`,
      declineInvitationUrl: `${this.config.getOrThrow('FRONTEND_URL')}/decline-invite?token=${token}`,
    });
  }

  async acceptInvitation(dto: AcceptInviteDto, userId: string) {
    const invite = await this.prisma.orgInvitation.findUnique({
      where: { token: dto.token },
      include: { org: { select: { plan: true, deletedAt: true } } },
    });
    if (!invite) throw new ResourceNotFoundException('Invitation', dto.token);

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

    if (user.email != invite.email) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'EMAIL_MISMATCH', 'Email does not match');
    }

    const memberCount = await this.prisma.orgMember.count({ where: { orgId: invite.orgId } });
    const limits: Record<Plan, number> = { FREE: 3, PRO: 20, BUSINESS: Infinity };

    if (memberCount >= limits[invite.org.plan]) {
      throw new PlanLimitException(
        `${invite.org.plan} plan allows up to ${limits[invite.org.plan]} members. Upgrade to invite more.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orgMember.create({
        data: {
          orgId: invite.orgId,
          userId,
          role: invite.role,
        },
      });

      await tx.orgInvitation.delete({
        where: { id: invite.id },
      });
    });
  }

  async declineInvitation(dto: DeclineInviteDto, userId: string): Promise<void> {
    const invite = await this.prisma.orgInvitation.findUnique({
      where: { token: dto.token },
      include: { org: { select: { plan: true, deletedAt: true } } },
    });
    if (!invite) throw new ResourceNotFoundException('Invitation', dto.token);

    if (invite.org.deletedAt) {
      throw new DomainException(
        HttpStatus.GONE,
        'ORG_INACTIVE',
        'This organization is no longer active.',
      );
    }

    const user = await this.findActiveUser(userId);

    if (user.email != invite.email) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'EMAIL_MISMATCH', 'Email does not match');
    }

    await this.prisma.orgInvitation.delete({ where: { token: dto.token } });
  }

  private async findActiveUser(userId: string, tx?: Prisma.TransactionClient): Promise<User> {
    const client = tx ?? this.prisma;

    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ResourceNotFoundException('User', userId);
    if (user.bannedAt) throw new BannedUserException();
    if (user.deletedAt) throw new ResourceNotFoundException('User', userId);

    return user;
  }
}
