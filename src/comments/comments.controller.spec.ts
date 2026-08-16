import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: jest.Mocked<CommentsService>;

  beforeEach(async () => {
    const mockService = {
      createComment: jest.fn(),
      listComments: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        { provide: CommentsService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    service = module.get(CommentsService);
  });

  it('createComment delegates to service.createComment', async () => {
    const mockComment = { id: 'c-1', body: 'Hello' } as any;
    service.createComment.mockResolvedValueOnce(mockComment);

    const dto = { body: 'Hello' };
    const result = await controller.createComment('org-1', 'team-1', 'proj-1', 't-1', dto, 'u-1');

    expect(service.createComment).toHaveBeenCalledWith(
      'org-1',
      'team-1',
      'proj-1',
      't-1',
      dto,
      'u-1',
    );
    expect(result).toBe(mockComment);
  });
});
