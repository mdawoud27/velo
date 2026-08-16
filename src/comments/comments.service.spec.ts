import { OrgRole, ProjectStatus } from '@prisma/client';
import { CommentsService } from './comments.service';

function makePrisma() {
  const prismaObj = {
    organization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    project: { findFirst: jest.fn() },
    task: { findFirst: jest.fn() },
    orgMember: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    projectMember: { findUnique: jest.fn() },
    comment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    taskWatcher: { findMany: jest.fn().mockResolvedValue([]) },
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
function makeGateway() {
  return { emitCommentAdded: jest.fn() } as any;
}
function makeNotifications() {
  return { createBulk: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CommentsService(prisma, makeActivity(), makeGateway(), makeNotifications());
  });

  describe('createComment', () => {
    it('creates a comment and logs activity', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({ id: 'org-1', deletedAt: null });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', bannedAt: null, deletedAt: null });
      prisma.orgMember.findUnique.mockResolvedValueOnce({
        userId: 'u-1',
        orgId: 'org-1',
        role: OrgRole.OWNER,
      });
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        status: ProjectStatus.ACTIVE,
      });
      prisma.task.findFirst.mockResolvedValueOnce({
        id: 't-1',
        projectId: 'proj-1',
        creatorId: 'u-2',
        title: 'Task 1',
      });

      const mockComment = {
        id: 'c-1',
        body: 'Great progress',
        taskId: 't-1',
        authorId: 'u-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: 'u-1', name: 'User 1', email: 'u1@test.com', avatarUrl: null },
      };
      prisma.comment.create.mockResolvedValueOnce(mockComment);

      const result = await service.createComment(
        'org-1',
        'team-1',
        'proj-1',
        't-1',
        { body: 'Great progress' },
        'u-1',
      );

      expect(result.id).toBe('c-1');
      expect(result.body).toBe('Great progress');
    });
  });
});
