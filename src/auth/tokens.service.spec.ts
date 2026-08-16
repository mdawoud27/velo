import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokensService } from './tokens.service';
import { SystemRole } from '@prisma/client';

function makeJwtService() {
  return {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    signAsync: jest.fn().mockResolvedValue('mock-async-token'),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
}

function makeRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    eval: jest.fn().mockResolvedValue(1),
  } as any;
}

function makeConfig() {
  return {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      const map: Record<string, string> = {
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_2FA_CHALLENGE_SECRET: '2fa-secret',
      };
      return map[key] || 'secret';
    }),
  } as unknown as ConfigService;
}

describe('TokensService', () => {
  let service: TokensService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    service = new TokensService(makeJwtService(), redis, makeConfig());
  });

  describe('generateTokens', () => {
    it('generates access and refresh tokens and stores refresh token hash', async () => {
      const user = { id: 'u-1', email: 'test@example.com', systemRole: SystemRole.USER };
      const tokens = await service.generateTokens(user);

      expect(tokens).toEqual({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-jwt-token',
      });
      expect(redis.setex).toHaveBeenCalledWith('refresh:u-1', expect.any(String), 604800);
    });
  });

  describe('revokeAllSessions & isIssuedBeforeRevocation', () => {
    it('revokeAllSessions sets tokens-valid-after key', async () => {
      await service.revokeAllSessions('u-1');
      expect(redis.setex).toHaveBeenCalledWith('tokens-valid-after:u-1', expect.any(String), 900);
    });

    it('isIssuedBeforeRevocation returns true if issuedAt < validAfter', async () => {
      redis.get.mockResolvedValueOnce('1000');
      const isRevoked = await service.isIssuedBeforeRevocation('u-1', 500);
      expect(isRevoked).toBe(true);
    });

    it('isIssuedBeforeRevocation returns false if issuedAt >= validAfter', async () => {
      redis.get.mockResolvedValueOnce('1000');
      const isRevoked = await service.isIssuedBeforeRevocation('u-1', 1500);
      expect(isRevoked).toBe(false);
    });

    it('isIssuedBeforeRevocation returns false if no revocation key is set', async () => {
      redis.get.mockResolvedValueOnce(null);
      const isRevoked = await service.isIssuedBeforeRevocation('u-1', 500);
      expect(isRevoked).toBe(false);
    });
  });
});
