import { UsersService } from './users.service';
import { UserEntity } from './entities';

function makePrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

function makeTokensService() {
  return {
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeRedis() {
  return {
    setex: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    getdel: jest.fn().mockResolvedValue(null),
  } as any;
}

function makeCloudinary() {
  return {
    upload: jest.fn(),
    deleteByUrl: jest.fn().mockResolvedValue(true),
  } as any;
}

function makeActivity() {
  return { log: jest.fn() } as any;
}
function makeCache() {
  return { invalidateUserCache: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeGateway() {
  return { disconnectUser: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeLogger() {
  return { error: jest.fn(), log: jest.fn() } as any;
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new UsersService(
      prisma,
      makeTokensService(),
      makeRedis(),
      makeCloudinary(),
      makeLogger(),
      makeActivity(),
      makeCache(),
      makeGateway(),
      makeNotifications(),
    );
  });

  describe('findMe', () => {
    it('returns UserEntity when active user is found', async () => {
      const activeUser = {
        id: 'u-1',
        email: 'test@example.com',
        name: 'Test',
        password: 'hashed',
        avatarUrl: null,
        isEmailVerified: true,
        twoFactorSecret: null,
        isTwoFactorEnabled: false,
        twoFactorBackupCodes: [],
        googleId: null,
        githubId: null,
        systemRole: 'USER',
        bannedAt: null,
        deletedAt: null,
        notifPreferences: {},
        stripeCustomerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findFirst.mockResolvedValueOnce(activeUser);

      const result = await service.findMe('u-1');

      expect(result.id).toBe('u-1');
      expect(result.email).toBe('test@example.com');
      expect(result).toBeInstanceOf(UserEntity);
    });
  });
});
