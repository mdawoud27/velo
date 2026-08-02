import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OrgRole, SystemRole } from '@prisma/client';
import { ROLES_KEY } from '../constants';
import type { JwtPayload } from '../interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const { user } = request;
    if (!user) return false;

    if (user.systemRole === SystemRole.SUPER_ADMIN) return true;
    const requestedOrgId =
      (request.params?.orgId as string | undefined) ?? (request.query?.orgId as string | undefined);

    if (!requestedOrgId || requestedOrgId !== user.orgId) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    return requiredRoles.some((role) => user.orgRole === role);
  }
}
