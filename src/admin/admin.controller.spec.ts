import { Test, TestingModule } from '@nestjs/testing';
import { Plan } from '@prisma/client';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { LoggerService } from 'src/logger/logger.service';

describe('AdminController', () => {
  let controller: AdminController;
  let service: jest.Mocked<AdminService>;

  beforeEach(async () => {
    const mockService = {
      getPlatformStats: jest.fn(),
      listUsers: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
      restoreUser: jest.fn(),
      promoteToAdmin: jest.fn(),
      overridePlan: jest.fn(),
      listDeletedTasks: jest.fn(),
      restoreTask: jest.fn(),
      getAuditLogs: jest.fn(),
      getQueueStats: jest.fn(),
      getFailedJobs: jest.fn(),
      retryJob: jest.fn(),
      deleteJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: LoggerService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get(AdminService);
  });

  it('getPlatformStats delegates to adminService', async () => {
    const mockStats = { users: { total: 10 } } as any;
    service.getPlatformStats.mockResolvedValueOnce(mockStats);

    const result = await controller.getPlatformStats();
    expect(result).toBe(mockStats);
  });

  it('banUser delegates to adminService', async () => {
    service.banUser.mockResolvedValueOnce(undefined);

    await controller.banUser('u-1', { reason: 'spam' }, 'admin-1');
    expect(service.banUser).toHaveBeenCalledWith('u-1', 'admin-1', 'spam');
  });

  it('overrideOrgPlan delegates to adminService', async () => {
    service.overridePlan.mockResolvedValueOnce(undefined);

    await controller.overrideOrgPlan('org-1', { plan: Plan.PRO }, 'admin-1');
    expect(service.overridePlan).toHaveBeenCalledWith('org-1', Plan.PRO, 'admin-1');
  });
});
