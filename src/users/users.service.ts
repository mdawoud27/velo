import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { JwtPayload } from 'src/auth/interfaces';
import { TokensService } from 'src/auth/tokens.service';
import { UserEntity } from './entities';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { InvalidCredentialsException, ResourceNotFoundException } from 'src/common/exceptions';
import { LoggerService } from 'src/logger/logger.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import type { NotifPreferences, UploadedFile } from './types';
import { NotifPreferencesDto, UpdateAccountDto, UpdatePasswordDto } from './dtos';

type AccessPayload = JwtPayload & { exp?: number };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly redis: RedisService,
    private readonly cloudinary: CloudinaryService,
    private readonly logger: LoggerService,
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

    return new UserEntity(user);
  }

  async updateNotifPreferences(userId: string, patch: NotifPreferencesDto): Promise<UserEntity> {
    await this.findActiveUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        notifPreferences: await this.mergeNotifPreferences(userId, patch),
      },
    });

    return new UserEntity(user);
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
  }

  async softDeleteMe(payload: AccessPayload): Promise<void> {
    const user = await this.findActiveUser(payload.sub);

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
  }

  async uploadAvatar(userId: string, file: UploadedFile): Promise<UserEntity> {
    const user = await this.findActiveUser(userId);
    const result = await this.cloudinary.upload(file, 'velo/avatars');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.secureUrl },
    });

    await this.deleteAvatarBestEffort(userId, user.avatarUrl);

    return new UserEntity(updated);
  }

  async deleteAvatar(userId: string): Promise<UserEntity> {
    const user = await this.findActiveUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    await this.deleteAvatarBestEffort(userId, user.avatarUrl);

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
    } catch (error) {
      this.logger.warn('Failed to delete avatar from Cloudinary', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async cleanupEmailVerificationKeys(userId: string): Promise<void> {
    const currentToken = await this.redis.getdel(`email-verify-current:${userId}`);
    if (currentToken) {
      await this.redis.del(`email-verify:${currentToken}`);
    }
  }
}
