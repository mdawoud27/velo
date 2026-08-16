import { BanGuard } from './ban.guard';
import { BannedUserException } from 'src/common/exceptions/banned-user.exception';
import { AccountDeactivatedException } from 'src/common/exceptions/account-deactivated.exception';

function makeContext(user?: { sub: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

function makeRedis(cachedValue: string | null = null) {
  return {
    get: jest.fn().mockResolvedValue(cachedValue),
    setex: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makePrisma(dbResult: { bannedAt: Date | null; deletedAt: Date | null } | null) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(dbResult),
    },
  } as any;
}

describe('BanGuard', () => {
  describe('when no user on the request (unauthenticated route)', () => {
    it('returns true without hitting Redis or DB', async () => {
      const redis = makeRedis();
      const prisma = makePrisma(null);
      const guard = new BanGuard(redis, prisma);

      const result = await guard.canActivate(makeContext(undefined));

      expect(result).toBe(true);
      expect(redis.get).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('when a cached ban status exists', () => {
    it('returns true immediately for cached "active" status', async () => {
      const redis = makeRedis('active');
      const prisma = makePrisma(null);
      const guard = new BanGuard(redis, prisma);

      const result = await guard.canActivate(makeContext({ sub: 'user-1' }));

      expect(result).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws BannedUserException for cached "banned" status', async () => {
      const guard = new BanGuard(makeRedis('banned'), makePrisma(null));
      await expect(guard.canActivate(makeContext({ sub: 'user-1' }))).rejects.toThrow(
        BannedUserException,
      );
    });

    it('throws AccountDeactivatedException for cached "inactive" status', async () => {
      const guard = new BanGuard(makeRedis('inactive'), makePrisma(null));
      await expect(guard.canActivate(makeContext({ sub: 'user-1' }))).rejects.toThrow(
        AccountDeactivatedException,
      );
    });
  });

  describe('when cache is empty (first request → DB lookup)', () => {
    it('returns true and caches "active" for a normal user', async () => {
      const redis = makeRedis(null);
      const prisma = makePrisma({ bannedAt: null, deletedAt: null });
      const guard = new BanGuard(redis, prisma);

      const result = await guard.canActivate(makeContext({ sub: 'user-2' }));

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith('user-ban:user-2', 'active', 300);
    });

    it('caches "banned" and throws BannedUserException for a banned user', async () => {
      const redis = makeRedis(null);
      const prisma = makePrisma({ bannedAt: new Date(), deletedAt: null });
      const guard = new BanGuard(redis, prisma);

      await expect(guard.canActivate(makeContext({ sub: 'user-3' }))).rejects.toThrow(
        BannedUserException,
      );
      expect(redis.setex).toHaveBeenCalledWith('user-ban:user-3', 'banned', 300);
    });

    it('caches "inactive" and throws AccountDeactivatedException when deletedAt is set', async () => {
      const redis = makeRedis(null);
      const prisma = makePrisma({ bannedAt: null, deletedAt: new Date() });
      const guard = new BanGuard(redis, prisma);

      await expect(guard.canActivate(makeContext({ sub: 'user-4' }))).rejects.toThrow(
        AccountDeactivatedException,
      );
      expect(redis.setex).toHaveBeenCalledWith('user-ban:user-4', 'inactive', 300);
    });

    it('caches "inactive" when the user record does not exist in DB', async () => {
      const redis = makeRedis(null);
      const prisma = makePrisma(null);
      const guard = new BanGuard(redis, prisma);

      await expect(guard.canActivate(makeContext({ sub: 'ghost' }))).rejects.toThrow(
        AccountDeactivatedException,
      );
      expect(redis.setex).toHaveBeenCalledWith('user-ban:ghost', 'inactive', 300);
    });

    it('uses cache key "user-ban:<userId>"', async () => {
      const redis = makeRedis(null);
      const prisma = makePrisma({ bannedAt: null, deletedAt: null });
      const guard = new BanGuard(redis, prisma);

      await guard.canActivate(makeContext({ sub: 'abc-123' }));

      expect(redis.get).toHaveBeenCalledWith('user-ban:abc-123');
    });
  });
});
