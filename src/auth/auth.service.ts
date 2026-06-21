import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { LoginDto, RegistrationDto, VerifyEmailDto } from './dtos';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  BannedUserException,
  EmailAlreadyRegisteredException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
  InvalidOrExpiredTokenException,
} from 'src/common/exceptions';
import { EmailQueueService } from 'src/queue/email-queue.service';
import { LoggerService } from 'src/logger/logger.service';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from './interfaces';
import { OrgMember, User } from '@prisma/client';
import { UserEntity } from './entities/user.entity';

type TokenUser = Pick<User, 'id' | 'email' | 'systemRole'>;
type TokenOrgMembership = Pick<OrgMember, 'orgId' | 'role'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegistrationDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new EmailAlreadyRegisteredException();
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        password: hashedPassword,
        isEmailVerified: false,
      },
    });

    const verificationToken = crypto.randomUUID();
    await this.redis.setex(`email-verify:${verificationToken}`, newUser.id.toString(), 86400);

    const verificationUrl = `${this.config.getOrThrow('FRONTEND_URL')}/verify-email?token=${verificationToken}`;

    await this.emailQueue.addWelcomeEmail({ to: newUser.email, name: newUser.name ?? '' });
    await this.emailQueue.addVerifyEmail({
      to: newUser.email,
      name: newUser.name ?? '',
      verificationUrl,
    });

    return { message: 'Check your inbox to verify your email' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const redisKey = `email-verify:${dto.token}`;
    const userId = await this.redis.get(redisKey);

    if (!userId) {
      throw new InvalidOrExpiredTokenException();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    await this.redis.del(redisKey);

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new InvalidOrExpiredTokenException();
    }

    if (!user.isEmailVerified) {
      throw new EmailNotVerifiedException();
    }

    if (user.bannedAt) {
      throw new BannedUserException();
    }

    const orgMember = await this.prisma.orgMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      select: { orgId: true, role: true },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user, orgMember ?? undefined);

    return { accessToken, refreshToken, user: new UserEntity(user) };
  }

  private async generateTokens(user: TokenUser, orgMembership?: TokenOrgMembership) {
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
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 12);
    await this.redis.setex(`refresh:${user.id}`, hashedRefresh, 7 * 24 * 60 * 60);

    return { accessToken, refreshToken };
  }
}
