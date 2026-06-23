import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtPayload } from '../interfaces';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user) return false;

    return user.systemRole === 'SUPER_ADMIN';
  }
}
