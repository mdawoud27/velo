import { OrgRole, Plan } from '@prisma/client';
import { OrganizationsService } from './organizations.service';

function makePrisma() {
  const prismaObj = {
    organization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
    },
    orgMember: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn(),
    },
    orgInvitation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(prismaObj);
      }
      return Promise.all(cb);
    }),
  } as any;
  return prismaObj;
}

function makeEmailQueue() {
  return { addInvitationEmail: jest.fn().mockResolvedValue(true) } as any;
}

function makeConfig() {
  return { getOrThrow: jest.fn().mockReturnValue('https://app.example.com') } as any;
}

function makeActivity() {
  return { log: jest.fn() } as any;
}

function makeCache() {
  return {
    invalidateUserCache: jest.fn().mockResolvedValue(undefined),
    invalidateOrganizationCache: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeGateway() {
  return { emitOrgMemberAdded: jest.fn() } as any;
}

function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeLogger() {
  return { error: jest.fn(), log: jest.fn(), warn: jest.fn() } as any;
}

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new OrganizationsService(
      prisma,
      makeEmailQueue(),
      makeConfig(),
      makeActivity(),
      makeCache(),
      makeGateway(),
      makeNotifications(),
      makeLogger(),
    );
  });

  describe('createOrganization', () => {
    it('creates an organization and assigns creator as OWNER', async () => {
      const activeUser = { id: 'user-1', bannedAt: null, deletedAt: null };
      prisma.user.findUnique.mockResolvedValueOnce(activeUser);

      const createdOrg = {
        id: 'org-1',
        name: 'Acme',
        description: 'Desc',
        plan: Plan.FREE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.organization.create.mockResolvedValueOnce(createdOrg);
      prisma.orgMember.create.mockResolvedValueOnce({
        id: 'mem-1',
        orgId: 'org-1',
        userId: 'user-1',
        role: OrgRole.OWNER,
      });

      const result = await service.createOrganization(
        { name: 'Acme', description: 'Desc' },
        'user-1',
      );

      expect(result.id).toBe('org-1');
      expect(result.name).toBe('Acme');
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: { name: 'Acme', description: 'Desc' },
      });
    });
  });
});
