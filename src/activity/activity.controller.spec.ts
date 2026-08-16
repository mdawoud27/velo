import { Test, TestingModule } from '@nestjs/testing';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { Reflector } from '@nestjs/core';

describe('ActivityController', () => {
  let controller: ActivityController;
  let service: jest.Mocked<ActivityService>;

  beforeEach(async () => {
    const mockService = {
      listActivityLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        { provide: ActivityService, useValue: mockService },
        { provide: Reflector, useValue: {} },
      ],
    }).compile();

    controller = module.get<ActivityController>(ActivityController);
    service = module.get(ActivityService);
  });

  it('delegates to activityService.listActivityLogs with default page & limit', async () => {
    const mockResult = {
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      data: [],
    };
    service.listActivityLogs.mockResolvedValueOnce(mockResult);

    const result = await controller.listActivityLogs({ orgId: 'org-1' } as any, 'user-1');

    expect(service.listActivityLogs).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      orgId: 'org-1',
      projectId: undefined,
      actorId: undefined,
      entityType: undefined,
      action: undefined,
      requesterId: 'user-1',
    });
    expect(result).toBe(mockResult);
  });
});
