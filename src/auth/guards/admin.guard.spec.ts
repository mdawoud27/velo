import { ForbiddenException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { AdminGuard } from './admin.guard';

function makeContext(user?: { systemRole: SystemRole }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('returns true for a SUPER_ADMIN user', () => {
    const ctx = makeContext({ systemRole: SystemRole.SUPER_ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException for a regular USER', () => {
    const ctx = makeContext({ systemRole: SystemRole.USER });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user on the request', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('error message mentions super admin privileges', () => {
    const ctx = makeContext({ systemRole: SystemRole.USER });
    expect(() => guard.canActivate(ctx)).toThrow(/super admin/i);
  });
});
