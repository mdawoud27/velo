import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function makeConfig() {
  return {
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;
}

function makeRedis(isBlacklisted = 0) {
  return {
    exists: jest.fn().mockResolvedValue(isBlacklisted),
  } as any;
}

describe('JwtStrategy', () => {
  it('validates and returns payload when JTI is not blacklisted', async () => {
    const strategy = new JwtStrategy(makeConfig(), makeRedis(0));
    const payload = { sub: 'u-1', email: 'a@b.com', jti: 'jti-1', systemRole: 'USER' } as any;

    const result = await strategy.validate(payload);
    expect(result).toBe(payload);
  });

  it('throws UnauthorizedException when JTI is blacklisted', async () => {
    const strategy = new JwtStrategy(makeConfig(), makeRedis(1));
    const payload = { sub: 'u-1', email: 'a@b.com', jti: 'jti-1', systemRole: 'USER' } as any;

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
