import { UnauthorizedException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { SystemRole } from '@prisma/client';

function makePrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orgMember: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

function makeTokensService() {
  return {
    generateTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  } as any;
}

function makeRedis() {
  return {
    setex: jest.fn().mockResolvedValue(undefined),
    getdel: jest.fn().mockResolvedValue(null),
  } as any;
}

describe('OAuthService', () => {
  let service: OAuthService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    service = new OAuthService(prisma, makeTokensService(), redis);
  });

  describe('handleOAuthLogin', () => {
    it('throws UnauthorizedException if emailVerified is false', async () => {
      const profile = {
        provider: 'google' as const,
        providerId: '123',
        email: 'test@example.com',
        name: 'Test',
        avatarUrl: null,
        emailVerified: false,
      };

      await expect(service.handleOAuthLogin(profile)).rejects.toThrow(UnauthorizedException);
    });

    it('logs in linked user and returns tokens', async () => {
      const profile = {
        provider: 'google' as const,
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Test',
        avatarUrl: null,
        emailVerified: true,
      };

      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'u-1',
        email: 'test@example.com',
        systemRole: SystemRole.USER,
        bannedAt: null,
        deletedAt: null,
      });

      const result = await service.handleOAuthLogin(profile);

      expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
    });
  });

  describe('storeOAuthCode & exchangeOAuthCode', () => {
    it('storeOAuthCode saves token payload into Redis with short TTL', async () => {
      const code = await service.storeOAuthCode({ accessToken: 'a', refreshToken: 'r' });
      expect(typeof code).toBe('string');
      expect(redis.setex).toHaveBeenCalledWith(
        `oauth-code:${code}`,
        JSON.stringify({ accessToken: 'a', refreshToken: 'r' }),
        60,
      );
    });

    it('exchangeOAuthCode throws UnauthorizedException if code is not in Redis', async () => {
      redis.getdel.mockResolvedValueOnce(null);
      await expect(service.exchangeOAuthCode('invalid-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('exchangeOAuthCode returns stored tokens on match', async () => {
      redis.getdel.mockResolvedValueOnce(JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
      const result = await service.exchangeOAuthCode('valid-code');
      expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
    });
  });
});
