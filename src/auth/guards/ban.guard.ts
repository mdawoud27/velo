import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from 'src/auth/interfaces';
import { AccountDeactivatedException, BannedUserException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class BanGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();

    if (!user) return true;

    const cacheKey = `user-ban:${user.sub}`;
    let cached = await this.redis.get(cacheKey);

    if (!cached) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { bannedAt: true, deletedAt: true },
      });

      if (!dbUser || dbUser.deletedAt) {
        cached = 'inactive';
      } else {
        cached = dbUser.bannedAt ? 'banned' : 'active';
      }
      await this.redis.setex(cacheKey, cached, 300);
    }

    if (cached === 'banned') {
      throw new BannedUserException();
    }

    if (cached === 'inactive') {
      throw new AccountDeactivatedException();
    }

    return true;
  }
}
