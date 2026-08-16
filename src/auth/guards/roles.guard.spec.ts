import { ForbiddenException } from '@nestjs/common';
import { OrgRole, SystemRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(
  user?: Partial<{ sub: string; systemRole: SystemRole; orgId: string; orgRole: OrgRole }>,
  params?: Record<string, string>,
  query?: Record<string, string>,
) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: params ?? {},
        query: query ?? {},
      }),
    }),
  } as any;
}

function makeReflector(roles: OrgRole[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('returns true when no roles requirement is set', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(guard.canActivate(makeContext({ sub: 'u1', systemRole: SystemRole.USER }))).toBe(true);
  });

  it('returns false when there is no user on the request', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.ADMIN]));
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('returns true for a SUPER_ADMIN regardless of required roles', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.OWNER]));
    const ctx = makeContext(
      { sub: 'admin', systemRole: SystemRole.SUPER_ADMIN, orgId: 'org-1', orgRole: OrgRole.MEMBER },
      { orgId: 'org-1' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when orgId param does not match user.orgId', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.ADMIN]));
    const ctx = makeContext(
      { sub: 'u1', systemRole: SystemRole.USER, orgId: 'org-A', orgRole: OrgRole.ADMIN },
      { orgId: 'org-B' }, // different org
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('returns true when user orgRole matches a required role', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.ADMIN, OrgRole.OWNER]));
    const ctx = makeContext(
      { sub: 'u1', systemRole: SystemRole.USER, orgId: 'org-1', orgRole: OrgRole.ADMIN },
      { orgId: 'org-1' },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns false when user orgRole does NOT match any required role', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.OWNER]));
    const ctx = makeContext(
      { sub: 'u1', systemRole: SystemRole.USER, orgId: 'org-1', orgRole: OrgRole.MEMBER },
      { orgId: 'org-1' },
    );
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('falls back to query.orgId when params.orgId is absent', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.ADMIN]));
    const ctx = makeContext(
      { sub: 'u1', systemRole: SystemRole.USER, orgId: 'org-1', orgRole: OrgRole.ADMIN },
      {}, // no params
      { orgId: 'org-1' }, // orgId in query
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws when no orgId is provided at all', () => {
    const guard = new RolesGuard(makeReflector([OrgRole.ADMIN]));
    const ctx = makeContext(
      { sub: 'u1', systemRole: SystemRole.USER, orgId: 'org-1', orgRole: OrgRole.ADMIN },
      {}, // no params
      {}, // no query
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
