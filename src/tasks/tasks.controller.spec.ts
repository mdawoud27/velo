import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

describe('TasksController', () => {
  let controller: TasksController;
  let service: jest.Mocked<TasksService>;

  beforeEach(async () => {
    const mockService = {
      createTask: jest.fn(),
      listTasks: jest.fn(),
      getTask: jest.fn(),
      updateTask: jest.fn(),
      updateStatus: jest.fn(),
      softDeleteTask: jest.fn(),
      addTags: jest.fn(),
      removeTags: jest.fn(),
      searchTasks: jest.fn(),
      watchTask: jest.fn(),
      unwatchTask: jest.fn(),
      addAttachments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get(TasksService);
  });

  it('createTask delegates to service.createTask', async () => {
    const mockTask = { id: 't-1', title: 'Task 1' } as any;
    service.createTask.mockResolvedValueOnce(mockTask);

    const dto = { title: 'Task 1' };
    const result = await controller.createTask('org-1', 'team-1', 'proj-1', dto, 'u-1');

    expect(service.createTask).toHaveBeenCalledWith('org-1', 'team-1', 'proj-1', dto, 'u-1');
    expect(result).toBe(mockTask);
  });
});
