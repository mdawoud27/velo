import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces';

export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return user.systemRole === 'SUPER_ADMIN';
  }
}
