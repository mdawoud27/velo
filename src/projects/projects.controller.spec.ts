import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExportQueueService } from 'src/queue/services';
import { RedisService } from 'src/redis/redis.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let service: jest.Mocked<ProjectsService>;

  beforeEach(async () => {
    const mockService = {
      createProject: jest.fn(),
      listProjects: jest.fn(),
      getProject: jest.fn(),
      updateProject: jest.fn(),
      updateProjectStatus: jest.fn(),
      softDeleteProject: jest.fn(),
      addMember: jest.fn(),
      listMembers: jest.fn(),
      removeMember: jest.fn(),
      getBoard: jest.fn(),
      getSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: mockService },
        { provide: ExportQueueService, useValue: {} },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    service = module.get(ProjectsService);
  });

  it('createProject delegates to service.createProject', async () => {
    const mockProj = { id: 'p-1', name: 'App' } as any;
    service.createProject.mockResolvedValueOnce(mockProj);

    const dto = { name: 'App' };
    const result = await controller.createProject('org-1', 'team-1', dto, 'u-1');

    expect(service.createProject).toHaveBeenCalledWith('org-1', 'team-1', dto, 'u-1');
    expect(result).toBe(mockProj);
  });
});
