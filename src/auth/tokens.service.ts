import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrgMember, User } from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';
import { JwtPayload } from './interfaces';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

type TokenUser = Pick<User, 'id' | 'email' | 'systemRole'>;
type TokenOrgMembership = Pick<OrgMember, 'orgId' | 'role'>;

@Injectable()
export class TokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async generateTokens(user: TokenUser, orgMembership?: TokenOrgMembership) {
    const jti = uuidv4();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti,
      systemRole: user.systemRole,
      orgId: orgMembership?.orgId,
      orgRole: orgMembership?.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 12);
    await this.redis.setex(`refresh:${user.id}`, hashedRefresh, 7 * 24 * 60 * 60);

    return { accessToken, refreshToken };
  }
}
