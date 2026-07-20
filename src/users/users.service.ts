import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { JwtPayload } from 'src/auth/interfaces';
import { TokensService } from 'src/auth/tokens.service';
import { UserEntity } from './entities';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { InvalidCredentialsException, ResourceNotFoundException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import type { NotifPreferences, UploadedFile } from './types';
import { NotifPreferencesDto, UpdateAccountDto, UpdatePasswordDto } from './dtos';
import { ActivityService } from 'src/activity/activity.service';
import { CacheService } from 'src/cache/cache.service';
import { RealtimeGateway } from 'src/realtime/realtime.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { LoggerService } from 'src/logger/logger.service';

type AccessPayload = JwtPayload & { exp?: number };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly redis: RedisService,
    private readonly cloudinary: CloudinaryService,
    private readonly logger: LoggerService,
    private readonly activity: ActivityService,
    private readonly cache: CacheService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async findMe(userId: string): Promise<UserEntity> {
    const user = await this.findActiveUser(userId);
    return new UserEntity(user);
  }

  async updateMe(userId: string, dto: UpdateAccountDto): Promise<UserEntity> {
    await this.findActiveUser(userId);

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.notifPreferences !== undefined) {
      data.notifPreferences = await this.mergeNotifPreferences(userId, dto.notifPreferences);
    }

    if (Object.keys(data).length === 0) {
      return this.findMe(userId);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    this.activity.log({
      action: 'user.updated',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
      metadata: { fields: Object.keys(dto) },
    });

    void this.cache.invalidateUserCache(userId).catch(() => {});

    return new UserEntity(user);
  }

  async updateNotifPreferences(userId: string, patch: NotifPreferencesDto): Promise<UserEntity> {
    const current = await this.findActiveUser(userId);
    const currentPrefs = (current.notifPreferences as NotifPreferences) ?? {};

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        notifPreferences: { ...currentPrefs, ...patch },
      },
    });

    this.activity.log({
      action: 'user.notification_preferences.updated',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
    });

    void this.cache.invalidateUserCache(userId).catch(() => {});

    return new UserEntity(user);
  }

  async getNotifPreferences(userId: string): Promise<NotifPreferences> {
    const user = await this.findActiveUser(userId);
    return (user.notifPreferences as NotifPreferences) ?? {};
  }

  async updatePassword(payload: AccessPayload, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.findActiveUser(payload.sub);
    if (!user.password) {
      throw new BadRequestException('This account does not have a password to update.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsException();
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.tokensService.revokeRefreshToken(user.id);
    await this.blacklistAccessToken(payload);

    void this.cache.invalidateUserCache(user.id).catch(() => {});

    this.activity.log({
      action: 'user.password.updated',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
    });

    void this.gateway
      .disconnectUser(user.id, 'Password was changed')
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to disconnect sessions after password change',
          err instanceof Error ? err : undefined,
          UsersService.name,
        ),
      );

    void this.tokensService
      .revokeAllSessions(user.id)
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to durably revoke sessions after password change',
          err instanceof Error ? err : undefined,
          UsersService.name,
        ),
      );

    void this.notifications
      .create({
        userId: user.id,
        type: 'user.password_changed',
        title: 'Your password was changed',
        body: "If this wasn't you, reset your password immediately.",
        entityType: 'User',
        entityId: user.id,
      })
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to send password-changed notification',
          err instanceof Error ? err : undefined,
          UsersService.name,
        ),
      );
  }

  async softDeleteMe(payload: AccessPayload): Promise<void> {
    const user = await this.findActiveUser(payload.sub);

    void this.tokensService
      .revokeAllSessions(user.id)
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to durably revoke sessions before deletion',
          err instanceof Error ? err : undefined,
          UsersService.name,
        ),
      );
    void this.gateway
      .disconnectUser(user.id, 'Account deleted')
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to disconnect sessions before deletion',
          err instanceof Error ? err : undefined,
          UsersService.name,
        ),
      );

    await Promise.all([
      this.tokensService.revokeRefreshToken(user.id),
      this.blacklistAccessToken(payload),
      this.cleanupEmailVerificationKeys(user.id),
    ]);

    await this.cacheUserAsInactive(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        avatarUrl: null,
        isEmailVerified: false,
        email: `deleted_${user.id}@void.local`,
      },
    });

    await this.deleteAvatarBestEffort(user.id, user.avatarUrl);

    void this.cache.invalidateUserCache(user.id).catch(() => {});

    this.activity.log({
      action: 'user.deleted',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
    });

    void this.gateway
      .disconnectUser(user.id, 'Account deleted')
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to disconnect deleted user sockets',
          err instanceof Error ? err : undefined,
          UsersService.name,
        ),
      );
  }

  async uploadAvatar(userId: string, file: UploadedFile): Promise<UserEntity> {
    const user = await this.findActiveUser(userId);
    const result = await this.cloudinary.upload(file, 'velo/avatars');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.secureUrl },
    });

    await this.deleteAvatarBestEffort(userId, user.avatarUrl);

    void this.cache.invalidateUserCache(userId).catch(() => {});

    this.activity.log({
      action: 'user.avatar.uploaded',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
    });

    return new UserEntity(updated);
  }

  async deleteAvatar(userId: string): Promise<UserEntity> {
    const user = await this.findActiveUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    await this.deleteAvatarBestEffort(userId, user.avatarUrl);

    void this.cache.invalidateUserCache(userId).catch(() => {});

    this.activity.log({
      action: 'user.avatar.deleted',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
    });

    return new UserEntity(updated);
  }

  private async findActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        bannedAt: null,
      },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    return user;
  }

  private async mergeNotifPreferences(
    userId: string,
    patch: NotifPreferences,
  ): Promise<Prisma.InputJsonObject> {
    const user = await this.findActiveUser(userId);
    const current = this.isJsonObject(user.notifPreferences) ? user.notifPreferences : {};

    return {
      ...current,
      ...this.removeUndefined(patch),
    };
  }

  private removeUndefined(patch: NotifPreferences): Prisma.InputJsonObject {
    return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async blacklistAccessToken(payload: AccessPayload): Promise<void> {
    if (!payload.exp) return;

    const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingTtl > 0) {
      await this.redis.setex(`blacklist:${payload.jti}`, '1', remainingTtl);
    }
  }

  private async cacheUserAsInactive(userId: string): Promise<void> {
    await this.redis.setex(`user-ban:${userId}`, 'inactive', 300);
  }

  private async deleteAvatarBestEffort(userId: string, avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) return;

    try {
      await this.cloudinary.deleteByUrl(avatarUrl);
    } catch (error: unknown) {
      this.logger.error(
        'Failed to delete avatar from Cloudinary',
        error instanceof Error ? error : undefined,
        UsersService.name,
      );
    }
  }

  private async cleanupEmailVerificationKeys(userId: string): Promise<void> {
    const currentToken = await this.redis.getdel(`email-verify-current:${userId}`);
    if (currentToken) {
      await this.redis.del(`email-verify:${currentToken}`);
    }
  }
}
