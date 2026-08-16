import { OrgRole } from '@prisma/client';
import { TeamsService } from './teams.service';

function makePrisma() {
  return {
    organization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    team: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    orgMember: { findUnique: jest.fn() },
    teamMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return Promise.all(cb);
    }),
  } as any;
}

function makeActivity() {
  return { log: jest.fn() } as any;
}
function makeCache() {
  return {
    invalidateOrganizationCache: jest.fn().mockResolvedValue(undefined),
    invalidateTeamCache: jest.fn().mockResolvedValue(undefined),
  } as any;
}
function makeGateway() {
  return {
    emitTeamCreated: jest.fn(),
    emitTeamUpdated: jest.fn(),
    emitTeamDeleted: jest.fn(),
  } as any;
}
function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeLogger() {
  return { error: jest.fn(), log: jest.fn() } as any;
}
function makeEvictionQueue() {
  return { enqueueEviction: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeEmailQueue() {
  return { addInvitationEmail: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TeamsService(
      prisma,
      makeActivity(),
      makeCache(),
      makeGateway(),
      makeNotifications(),
      makeLogger(),
      makeEvictionQueue(),
      makeEmailQueue(),
    );
  });

  describe('createTeam', () => {
    it('creates team when actor is org ADMIN', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({ id: 'org-1', deletedAt: null });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', bannedAt: null, deletedAt: null });
      prisma.orgMember.findUnique.mockResolvedValueOnce({
        userId: 'u-1',
        orgId: 'org-1',
        role: OrgRole.ADMIN,
      });

      const mockTeam = {
        id: 'team-1',
        name: 'Engineering',
        description: 'Dev team',
        orgId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.team.create.mockResolvedValueOnce(mockTeam);

      const result = await service.createTeam('org-1', { name: 'Engineering' }, 'u-1');

      expect(result.id).toBe('team-1');
      expect(result.name).toBe('Engineering');
    });
  });
});
