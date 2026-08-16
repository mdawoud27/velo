import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../constants';

function makeContext() {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

function makeReflector(isPublic: boolean | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

describe('JwtAuthGuard', () => {
  it('returns true immediately for a route decorated with @Public()', () => {
    const reflector = makeReflector(true);
    const guard = new JwtAuthGuard(reflector);
    const ctx = makeContext();

    // Override super.canActivate so it is never called for public routes
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // Ensure Passport's canActivate was NOT called for the public route
    expect(superSpy).not.toHaveBeenCalled();
    superSpy.mockRestore();
  });

  it('delegates to Passport canActivate for non-public routes', () => {
    const reflector = makeReflector(undefined);
    const guard = new JwtAuthGuard(reflector);
    const ctx = makeContext();

    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    guard.canActivate(ctx);

    expect(superSpy).toHaveBeenCalledWith(ctx);
    superSpy.mockRestore();
  });
});
