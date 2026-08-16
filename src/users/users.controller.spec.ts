import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const mockService = {
      findMe: jest.fn(),
      updateMe: jest.fn(),
      getNotifPreferences: jest.fn(),
      updateNotifPreferences: jest.fn(),
      updatePassword: jest.fn(),
      softDeleteMe: jest.fn(),
      uploadAvatar: jest.fn(),
      deleteAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('getMe delegates to usersService.findMe', async () => {
    const mockUser = { id: 'u-1', email: 'a@b.com' } as any;
    service.findMe.mockResolvedValueOnce(mockUser);

    const result = await controller.getMe('u-1');

    expect(service.findMe).toHaveBeenCalledWith('u-1');
    expect(result).toBe(mockUser);
  });
});
