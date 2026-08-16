import { OrgRole, ProjectStatus, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';

function makePrisma() {
  const prismaObj = {
    organization: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    project: { findFirst: jest.fn() },
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    orgMember: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    projectMember: { findUnique: jest.fn() },
    taskWatcher: { upsert: jest.fn(), deleteMany: jest.fn() },
    attachment: { create: jest.fn() },
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
    invalidateProjectCache: jest.fn().mockResolvedValue(undefined),
    invalidateTaskCache: jest.fn().mockResolvedValue(undefined),
  } as any;
}
function makeGateway() {
  return {
    emitTaskCreated: jest.fn(),
    emitTaskUpdated: jest.fn(),
    emitTaskDeleted: jest.fn(),
  } as any;
}
function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeLogger() {
  return { error: jest.fn(), log: jest.fn() } as any;
}
function makeEmailQueue() {
  return { addTaskAssignedEmail: jest.fn().mockResolvedValue(undefined) } as any;
}
function makeCloudinary() {
  return { upload: jest.fn() } as any;
}

describe('TasksService', () => {
  let service: TasksService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TasksService(
      prisma,
      makeActivity(),
      makeCache(),
      makeGateway(),
      makeNotifications(),
      makeLogger(),
      makeEmailQueue(),
      makeCloudinary(),
    );
  });

  describe('createTask', () => {
    it('creates a task when actor has permission', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({ id: 'org-1', deletedAt: null });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', bannedAt: null, deletedAt: null });
      prisma.orgMember.findUnique.mockResolvedValueOnce({
        userId: 'u-1',
        orgId: 'org-1',
        role: OrgRole.OWNER,
      });
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', status: ProjectStatus.ACTIVE });
      prisma.task.findFirst.mockResolvedValueOnce(null); // title available

      const mockTask = {
        id: 'task-1',
        title: 'Fix Bug',
        description: 'Detail',
        status: TaskStatus.TODO,
        priority: 'MEDIUM',
        tags: [],
        dueDate: null,
        projectId: 'proj-1',
        creatorId: 'u-1',
        assigneeId: null,
        parentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignee: null,
      };
      prisma.task.create.mockResolvedValueOnce(mockTask);

      const result = await service.createTask(
        'org-1',
        'team-1',
        'proj-1',
        { title: 'Fix Bug' },
        'u-1',
      );

      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Fix Bug');
    });
  });
});
