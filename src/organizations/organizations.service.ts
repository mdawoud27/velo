import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dtos/create-org.dto';
import { ResourceNotFoundException } from 'src/common/exceptions';
import { User } from '@prisma/client';
import { OrgEntity } from './entities';

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrgainzation(dto: CreateOrganizationDto, userId: string) {
    await this.findActiveUser(userId);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: dto });
      await tx.orgMember.create({ data: { orgId: org.id, userId, role: OrgRole.OWNER } });
      return new OrgEntity(org);
    });
  }

  private async findActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        bannedAt: null,
      },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    return user;
  }
}
