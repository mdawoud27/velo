import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OAuthProfile } from '../interfaces';
import { TokensService } from '../tokens.service';
import { RedisService } from 'src/redis/redis.service';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { AccountDeactivatedException } from 'src/common/exceptions';
import type { TokenUser } from './types';

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly redis: RedisService,
  ) {}

  async handleOAuthLogin(
    profile: OAuthProfile,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Reject unverified emails regardless of what the strategy passed through
    if (!profile.emailVerified) {
      throw new UnauthorizedException(
        'OAuth provider did not confirm email ownership. Cannot link account.',
      );
    }

    const providerField = profile.provider === 'google' ? 'googleId' : 'githubId';
    let user: TokenUser;

    try {
      user = await this.findOrLinkOrCreate(profile, providerField);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.user.findFirst({
          where: { [providerField]: profile.providerId },
          select: { id: true, email: true, systemRole: true, bannedAt: true, deletedAt: true },
        });
        if (!existing) throw error;
        user = existing;
      } else {
        throw error;
      }
    }

    if (user.deletedAt) {
      throw new AccountDeactivatedException();
    }

    if (user.bannedAt) {
      throw new UnauthorizedException('Account is banned.');
    }

    const orgMember = await this.prisma.orgMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      select: { orgId: true, role: true },
    });

    return this.tokensService.generateTokens(user, orgMember ?? undefined);
  }

  async storeOAuthCode(tokens: { accessToken: string; refreshToken: string }): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.redis.setex(`oauth-code:${code}`, JSON.stringify(tokens), 60);
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await this.redis.getdel(`oauth-code:${code}`);
    if (!stored) {
      throw new UnauthorizedException('OAuth code is invalid or has expired.');
    }
    return JSON.parse(stored) as { accessToken: string; refreshToken: string };
  }

  private async findOrLinkOrCreate(
    profile: OAuthProfile,
    providerField: 'googleId' | 'githubId',
  ): Promise<TokenUser> {
    const select = {
      id: true,
      email: true,
      systemRole: true,
      bannedAt: true,
      deletedAt: true,
    } as const;

    // Case 1: already linked
    const linked = await this.prisma.user.findFirst({
      where: { [providerField]: profile.providerId },
      select,
    });
    if (linked) return linked;

    // Case 2: email exists so link the account.
    const byEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select,
    });

    if (byEmail) {
      if (byEmail.deletedAt) {
        throw new AccountDeactivatedException();
      }

      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          [providerField]: profile.providerId,
          isEmailVerified: true,
        },
        select,
      });
    }

    // Case 3: new user
    return this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        [providerField]: profile.providerId,
        isEmailVerified: true,
      },
      select,
    });
  }
}
