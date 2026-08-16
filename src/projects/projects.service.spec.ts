import { OrgRole, ProjectStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';

function makePrisma() {
  const prismaObj = {
    organization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    team: { findFirst: jest.fn() },
    orgMember: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn(),
    },
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(prismaObj);
      }
      return Promise.all(cb);
    }),
  } as any;
  return prismaObj;
}

function makeActivity() {
  return { log: jest.fn() } as any;
}
function makeCache() {
  return {
    invalidateTeamCache: jest.fn().mockResolvedValue(undefined),
    invalidateProjectCache: jest.fn().mockResolvedValue(undefined),
    invalidateUserCache: jest.fn().mockResolvedValue(undefined),
  } as any;
}
function makeRedis() {
  return {} as any;
}
function makeGateway() {
  return {
    emitProjectCreated: jest.fn(),
    emitProjectUpdated: jest.fn(),
    emitProjectDeleted: jest.fn(),
    emitProjectMemberAdded: jest.fn(),
    emitProjectMemberRemoved: jest.fn(),
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

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ProjectsService(
      prisma,
      makeActivity(),
      makeCache(),
      makeRedis(),
      makeGateway(),
      makeNotifications(),
      makeLogger(),
      makeEvictionQueue(),
    );
  });

  describe('createProject', () => {
    it('creates a project when actor is org OWNER', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({ id: 'org-1', deletedAt: null });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', bannedAt: null, deletedAt: null });
      prisma.team.findFirst.mockResolvedValue({ id: 'team-1', orgId: 'org-1' });
      prisma.orgMember.findUnique.mockResolvedValueOnce({
        userId: 'u-1',
        orgId: 'org-1',
        role: OrgRole.OWNER,
      });
      prisma.project.findFirst.mockResolvedValueOnce(null);

      const mockProject = {
        id: 'p-1',
        name: 'Website Redesign',
        description: 'New design',
        status: ProjectStatus.ACTIVE,
        deadline: null,
        teamId: 'team-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.project.create.mockResolvedValueOnce(mockProject);

      const result = await service.createProject(
        'org-1',
        'team-1',
        { name: 'Website Redesign' },
        'u-1',
      );

      expect(result.id).toBe('p-1');
      expect(result.name).toBe('Website Redesign');
    });
  });
});
