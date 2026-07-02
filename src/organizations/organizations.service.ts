import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dtos/create-org.dto';
import { BannedUserException, ResourceNotFoundException } from 'src/common/exceptions';
import { Prisma, User } from '@prisma/client';
import { OrgEntity } from './entities';

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(dto: CreateOrganizationDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.findActiveUser(userId, tx);

      const org = await tx.organization.create({ data: dto });
      await tx.orgMember.create({ data: { orgId: org.id, userId, role: OrgRole.OWNER } });
      return new OrgEntity(org);
    });
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
