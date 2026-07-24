import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../interfaces';
import { SystemRole } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user || user.systemRole !== SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException('This endpoint requires super admin privileges');
    }

    return true;
  }
}
