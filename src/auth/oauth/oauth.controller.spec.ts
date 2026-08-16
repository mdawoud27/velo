import { Test, TestingModule } from '@nestjs/testing';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

import { ConfigService } from '@nestjs/config';
import { LoggerService } from 'src/logger/logger.service';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Reflector } from '@nestjs/core';

describe('OAuthController', () => {
  let controller: OAuthController;
  let service: jest.Mocked<OAuthService>;

  beforeEach(async () => {
    const mockService = {
      handleOAuthLogin: jest.fn(),
      storeOAuthCode: jest.fn(),
      exchangeOAuthCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        { provide: OAuthService, useValue: mockService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: LoggerService, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: Reflector, useValue: {} },
      ],
    }).compile();

    controller = module.get<OAuthController>(OAuthController);
    service = module.get(OAuthService);
  });

  it('exchangeCode delegates to oAuthService.exchangeOAuthCode', async () => {
    const mockTokens = { accessToken: 'a', refreshToken: 'r' };
    service.exchangeOAuthCode.mockResolvedValueOnce(mockTokens);

    const result = await controller.exchangeCode({ code: 'valid-code' });

    expect(service.exchangeOAuthCode).toHaveBeenCalledWith('valid-code');
    expect(result).toBe(mockTokens);
  });
});
