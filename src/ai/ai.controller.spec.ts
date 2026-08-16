import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { Reflector } from '@nestjs/core';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

describe('AiController', () => {
  let controller: AiController;
  let service: jest.Mocked<AiService>;

  beforeEach(async () => {
    const mockService = {
      suggest: jest.fn(),
      streamSuggest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: mockService },
        { provide: Reflector, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get(AiService);
  });

  it('suggest delegates to aiService.suggest', async () => {
    const mockSuggestion = { title: 'AI Task' } as any;
    service.suggest.mockResolvedValueOnce(mockSuggestion);

    const dto = { context: 'Build dashboard' };
    const result = await controller.suggest(dto);

    expect(service.suggest).toHaveBeenCalledWith(dto);
    expect(result).toBe(mockSuggestion);
  });

  it('streamSuggest delegates to aiService.streamSuggest', () => {
    const mockStream$ = of({ data: 'chunk' } as MessageEvent);
    service.streamSuggest.mockReturnValueOnce(mockStream$);

    const dto = { context: 'Build dashboard' };
    const result = controller.streamSuggest(dto);

    expect(service.streamSuggest).toHaveBeenCalledWith(dto);
    expect(result).toBe(mockStream$);
  });
});
