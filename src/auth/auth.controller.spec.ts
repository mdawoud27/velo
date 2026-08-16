import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockService = {
      register: jest.fn(),
      resendVerificationEmail: jest.fn(),
      verifyEmail: jest.fn(),
      login: jest.fn(),
      generate2FaSecret: jest.fn(),
      enable2Fa: jest.fn(),
      disable2Fa: jest.fn(),
      verify2Fa: jest.fn(),
      refreshToken: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockService },
        { provide: Reflector, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  it('register delegates to authService.register', async () => {
    service.register.mockResolvedValueOnce(undefined);

    const dto = { name: 'Bob', email: 'b@c.com', password: 'P!1' };
    await controller.register(dto);

    expect(service.register).toHaveBeenCalledWith(dto);
  });
});
