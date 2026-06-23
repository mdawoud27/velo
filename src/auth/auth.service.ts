import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegistrationDto,
  ResendEmailDto,
  ResetPassword,
  VerifyEmailDto,
} from './dtos';
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
    const email = dto.email.trim();

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

  async resendVerificationEmail(dto: ResendEmailDto) {
    const email = dto.email.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isEmailVerified: true },
    });

    if (!user) {
      return { message: 'No account with that email exists.' };
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified' };
    }

    const verificationToken = crypto.randomUUID();
    await this.redis.setex(`email-verify:${verificationToken}`, user.id.toString(), 86400);

    const verificationUrl = `${this.config.getOrThrow('FRONTEND_URL')}/verify-email?token=${verificationToken}`;
    await this.emailQueue.addVerifyEmail({
      to: user.email,
      name: user.name ?? '',
      verificationUrl,
    });

    return { message: 'If that account needs verification, a new email has been sent.' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const userId = await this.redis.getdel(`email-verify:${dto.token}`);

    if (!userId) {
      throw new InvalidOrExpiredTokenException();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
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

  async refreshToken(dto: RefreshTokenDto) {
    let decodedToken: JwtPayload;
    try {
      decodedToken = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new InvalidOrExpiredTokenException();
    }

    const userId = decodedToken.sub;

    const storedHash = await this.redis.get(`refresh:${userId}`);
    const isMatch = await bcrypt.compare(dto.refreshToken, storedHash ?? '');

    if (!isMatch) {
      await this.redis.del(`refresh:${userId}`);
      throw new InvalidOrExpiredTokenException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new InvalidCredentialsException();
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

    const hashedRefresh = await bcrypt.hash(refreshToken, 12);
    await this.redis.setex(`refresh:${user.id}`, hashedRefresh, 7 * 24 * 60 * 60);

    return { accessToken, refreshToken };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'If that account exists, a reset link has been sent' };
    }

    if (!user.isEmailVerified) {
      throw new EmailNotVerifiedException();
    }

    if (user.bannedAt) {
      throw new BannedUserException();
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.redis.setex(`pwd-reset:${resetToken}`, user.id.toString(), 3600);

    const resetUrl = `${this.config.getOrThrow('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    await this.emailQueue.addPasswordResetEmail({
      to: user.email,
      name: user.name ?? '',
      resetUrl,
    });

    return { message: 'If that account exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPassword) {
    const userId = await this.redis.getdel(`pwd-reset:${dto.token}`);
    if (!userId) {
      throw new InvalidOrExpiredTokenException();
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.redis.del(`refresh:${userId}`);

    return { message: 'Password reset successfully' };
  }

  async logout(payload: JwtPayload & { exp: number }) {
    const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);

    if (remainingTtl > 0) {
      await this.redis.setex(`blacklist:${payload.jti}`, '1', remainingTtl);
    }

    await this.redis.del(`refresh:${payload.sub}`);

    return { message: 'You are logged out successfully' };
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
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 12);
    await this.redis.setex(`refresh:${user.id}`, hashedRefresh, 7 * 24 * 60 * 60);

    return { accessToken, refreshToken };
  }
}
