import { EmailAlreadyRegisteredException } from 'src/common/exceptions';
import { AuthService } from './auth.service';

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    orgMember: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeRedis() {
  return {
    setex: jest.fn().mockResolvedValue(undefined),
    getdel: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
    ttl: jest.fn().mockResolvedValue(300),
  } as any;
}

function makeEmailQueue() {
  return {
    addWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    addVerifyEmail: jest.fn().mockResolvedValue(undefined),
    addPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeConfig() {
  return {
    getOrThrow: jest.fn().mockReturnValue('https://app.example.com'),
  } as any;
}

function makeLogger() {
  return { error: jest.fn(), log: jest.fn(), warn: jest.fn() } as any;
}
function makeJwtService() {
  return { verify: jest.fn() } as any;
}
function makeTokensService() {
  return {
    generateTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    generateTwoFaChallengeToken: jest.fn().mockResolvedValue('challenge'),
    verifyTwoFaChallengeToken: jest.fn().mockResolvedValue('u-1'),
    verifyAndConsumeRefreshToken: jest.fn().mockResolvedValue('valid'),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
  } as any;
}
function makeActivity() {
  return { log: jest.fn() } as any;
}
function makeGateway() {
  return { disconnectUser: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(
      prisma,
      makeRedis(),
      makeEmailQueue(),
      makeConfig(),
      makeLogger(),
      makeJwtService(),
      makeTokensService(),
      makeActivity(),
      makeGateway(),
      makeNotifications(),
    );
  });

  describe('register', () => {
    it('throws EmailAlreadyRegisteredException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-1' });

      await expect(
        service.register({ name: 'Bob', email: 'bob@example.com', password: 'Password123!' }),
      ).rejects.toThrow(EmailAlreadyRegisteredException);
    });

    it('creates new user and queues verification email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-1',
        name: 'Bob',
        email: 'bob@example.com',
        isEmailVerified: false,
      });

      await service.register({ name: 'Bob', email: 'bob@example.com', password: 'Password123!' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Bob',
          email: 'bob@example.com',
        }),
      });
    });
  });
});
