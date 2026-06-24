import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OAuthProfile } from '../interfaces';
import { TokensService } from '../tokens.service';

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
  ) {}

  async handleOAuthLogin(
    profile: OAuthProfile,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const providerField = profile.provider === 'google' ? 'googleId' : 'githubId';

    // Case 1: user already linked this OAuth provider
    let user = await this.prisma.user.findFirst({
      where: { [providerField]: profile.providerId },
    });

    if (!user) {
      // Case 2: email already exists (registered with password) so we just link the account
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            [providerField]: profile.providerId,
            avatarUrl: existingByEmail.avatarUrl ?? profile.avatarUrl,
            isEmailVerified: true,
          },
        });
      } else {
        // Case 3: brand-new user
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            [providerField]: profile.providerId,
            isEmailVerified: true,
          },
        });
      }
    }

    const orgMember = await this.prisma.orgMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      select: { orgId: true, role: true },
    });

    return this.tokensService.generateTokens(user, orgMember ?? undefined);
  }
}
