import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: jest.Mocked<OrganizationsService>;

  beforeEach(async () => {
    const mockService = {
      createOrganization: jest.fn(),
      inviteMember: jest.fn(),
      bulkInviteMembers: jest.fn(),
      resendInvite: jest.fn(),
      acceptInvitation: jest.fn(),
      declineInvitation: jest.fn(),
      listInvitations: jest.fn(),
      getUserOrgs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    service = module.get(OrganizationsService);
  });

  it('createOrganization delegates to service.createOrganization', async () => {
    const mockOrg = { id: 'org-1', name: 'Acme' } as any;
    service.createOrganization.mockResolvedValueOnce(mockOrg);

    const dto = { name: 'Acme' };
    const result = await controller.createOrganization(dto, 'user-1');

    expect(service.createOrganization).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toBe(mockOrg);
  });
});
