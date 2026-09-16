import { INestApplication } from '@nestjs/common';
import { User } from '@prisma/client';
import { TokensService } from 'src/auth/tokens.service';

export async function getAuthHeader(
  app: INestApplication,
  user: User,
  orgMembership?: { orgId: string; role: any },
): Promise<{ Authorization: string }> {
  const tokensService = app.get(TokensService);
  const { accessToken } = await tokensService.generateTokens(user, orgMembership);
  return { Authorization: `Bearer ${accessToken}` };
}
