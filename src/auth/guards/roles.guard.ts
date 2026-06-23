import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { OrgRole } from '../types';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { JwtPayload } from '../interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user) return false;

    return requiredRoles.some((role) => user.orgRole === role);
  }
}
