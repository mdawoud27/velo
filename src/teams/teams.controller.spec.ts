import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

describe('TeamsController', () => {
  let controller: TeamsController;
  let service: jest.Mocked<TeamsService>;

  beforeEach(async () => {
    const mockService = {
      createTeam: jest.fn(),
      getTeam: jest.fn(),
      updateTeam: jest.fn(),
      softDeleteTeam: jest.fn(),
      listTeams: jest.fn(),
      addMember: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      listMembers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: TeamsService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
    service = module.get(TeamsService);
  });

  it('createTeam delegates to service.createTeam', async () => {
    const mockTeam = { id: 'team-1', name: 'Devs' } as any;
    service.createTeam.mockResolvedValueOnce(mockTeam);

    const dto = { name: 'Devs' };
    const result = await controller.createTeam('org-1', dto, 'u-1');

    expect(service.createTeam).toHaveBeenCalledWith('org-1', dto, 'u-1');
    expect(result).toBe(mockTeam);
  });
});
