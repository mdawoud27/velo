import { Injectable, UnauthorizedException } from '@nestjs/common';
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
  AccountDeactivatedException,
  BannedUserException,
  EmailAlreadyRegisteredException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
  InvalidOrExpiredTokenException,
} from 'src/common/exceptions';
import { EmailQueueService } from 'src/queue/email-queue.service';
import { LoggerService } from 'src/logger/logger.service';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces';
import { UserEntity } from '../users/entities';
import { TokensService } from './tokens.service';
import { ServiceMessage } from 'src/common/classes';
import { ActivityService } from 'src/activity/activity.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly jwtService: JwtService,
    private readonly tokensService: TokensService,
    private readonly activity: ActivityService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
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
    const ttl = 86400;

    await Promise.all([
      this.redis.setex(`email-verify:${verificationToken}`, newUser.id.toString(), ttl),
      this.redis.setex(`email-verify-current:${newUser.id}`, verificationToken, ttl),
    ]);

    const verificationUrl = `${this.config.getOrThrow('FRONTEND_URL')}/verify-email?token=${verificationToken}`;

    await this.emailQueue.addWelcomeEmail({ to: newUser.email, name: newUser.name ?? '' });
    await this.emailQueue.addVerifyEmail({
      to: newUser.email,
      name: newUser.name ?? '',
      verificationUrl,
    });

    this.activity.log({
      action: 'auth.registered',
      entityType: 'User',
      entityId: newUser.id,
      actorId: newUser.id,
    });
  }

  async resendVerificationEmail(dto: ResendEmailDto) {
    const email = dto.email.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isEmailVerified: true },
    });

    if (!user || user.isEmailVerified) {
      return new ServiceMessage('If that account needs verification, a new email has been sent.');
    }

    const verificationToken = crypto.randomUUID();
    const ttl = 86400;

    const oldToken = await this.redis.getdel(`email-verify-current:${user.id}`);
    if (oldToken) {
      await this.redis.del(`email-verify:${oldToken}`);
    }

    await Promise.all([
      this.redis.setex(`email-verify:${verificationToken}`, user.id.toString(), ttl),
      this.redis.setex(`email-verify-current:${user.id}`, verificationToken, ttl),
    ]);

    const verificationUrl = `${this.config.getOrThrow('FRONTEND_URL')}/verify-email?token=${verificationToken}`;
    await this.emailQueue.addVerifyEmail({
      to: user.email,
      name: user.name ?? '',
      verificationUrl,
    });

    return new ServiceMessage('If that account needs verification, a new email has been sent.');
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const userId = await this.redis.getdel(`email-verify:${dto.token}`);

    if (!userId) {
      throw new InvalidOrExpiredTokenException();
    }

    const currentToken = await this.redis.getdel(`email-verify-current:${userId}`);
    if (currentToken && currentToken !== dto.token) {
      const remainingTtl = await this.redis.ttl(`email-verify:${currentToken}`);
      if (remainingTtl > 0) {
        await this.redis.setex(`email-verify-current:${userId}`, currentToken, remainingTtl);
      }
      throw new InvalidOrExpiredTokenException();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    this.activity.log({
      action: 'auth.email.verified',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
    });

    return new ServiceMessage('Email verified successfully');
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password || user.deletedAt) {
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

    const { accessToken, refreshToken } = await this.tokensService.generateTokens(
      user,
      orgMember ?? undefined,
    );

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

    const status = await this.tokensService.verifyAndConsumeRefreshToken(userId, dto.refreshToken);

    switch (status) {
      case 'missing':
        // Expired, logged out, or already rotated so nothing to revoke
        throw new UnauthorizedException('Session expired. Please log in again.');

      case 'mismatch':
        // Wrong token so don't touch the stored one, it may belong to a live session
        throw new UnauthorizedException('Invalid refresh token. Please log in again.');

      case 'race_lost':
        // Concurrent rotation won so both were valid, client should retry
        throw new UnauthorizedException('Refresh token already used. Please retry.');

      case 'valid':
        // Token consumed so issue a fresh pair
        break;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        systemRole: true,
        isEmailVerified: true,
        bannedAt: true,
        deletedAt: true,
      },
    });
    if (!user) throw new InvalidOrExpiredTokenException();
    if (!user.isEmailVerified) throw new EmailNotVerifiedException();
    if (user.deletedAt) throw new AccountDeactivatedException();
    if (user.bannedAt) throw new BannedUserException();

    const orgMember = await this.prisma.orgMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      select: { orgId: true, role: true },
    });

    this.activity.log({
      action: 'auth.session.renewed',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
    });

    return this.tokensService.generateTokens(user, orgMember ?? undefined);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt) {
      return new ServiceMessage('If that account exists, a reset link has been sent');
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

    this.activity.log({
      action: 'auth.password.reset.requested',
      entityType: 'User',
      entityId: user.id.toString(),
      actorId: user.id.toString(),
    });

    void this.notifications
      .notify({
        userId: user.id,
        type: 'auth.password_reset_requested',
        title: 'Password reset requested',
        body: "If this wasn't you, ignore this email.",
        entityType: 'User',
        entityId: user.id,
      })
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to send password-reset-requested notification',
          err instanceof Error ? err : undefined,
          AuthService.name,
        ),
      );

    return new ServiceMessage('If that account exists, a reset link has been sent');
  }

  async resetPassword(dto: ResetPassword) {
    const userId = await this.redis.getdel(`pwd-reset:${dto.token}`);
    if (!userId) {
      throw new InvalidOrExpiredTokenException();
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    const result = await this.prisma.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: { password: hashedPassword },
    });

    if (result.count === 0) {
      throw new AccountDeactivatedException();
    }

    await this.redis.del(`refresh:${userId}`);

    this.activity.log({
      action: 'auth.password.reset.completed',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
    });

    void this.notifications
      .notify({
        userId,
        type: 'user.password_changed',
        title: 'Your password was changed',
        body: "If this wasn't you, contact support immediately.",
        entityType: 'User',
        entityId: userId,
      })
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to send password-changed notification',
          err instanceof Error ? err : undefined,
          AuthService.name,
        ),
      );

    void this.gateway
      .disconnectUser(userId, 'Password was reset')
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to disconnect sessions after password reset',
          err instanceof Error ? err : undefined,
          AuthService.name,
        ),
      );
  }

  async logout(payload: JwtPayload & { exp: number }) {
    const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);

    if (remainingTtl > 0) {
      await this.redis.setex(`blacklist:${payload.jti}`, '1', remainingTtl);
    }

    await this.redis.del(`refresh:${payload.sub}`);

    this.activity.log({
      action: 'auth.logout',
      entityType: 'User',
      entityId: payload.sub,
      actorId: payload.sub,
    });
  }
}
