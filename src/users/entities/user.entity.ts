import { User, SystemRole, Prisma } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity implements User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  systemRole: SystemRole;
  notifPreferences: Prisma.JsonValue;
  isTwoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  deletedAt: Date | null;

  @Exclude()
  password: string | null;

  @Exclude()
  googleId: string | null;

  @Exclude()
  githubId: string | null;

  @Exclude()
  stripeCustomerId: string | null;

  @Exclude()
  bannedAt: Date | null;

  @Exclude()
  twoFactorSecret: string | null;

  @Exclude()
  twoFactorBackupCodes: string[];

  constructor(user: User) {
    Object.assign(this, user);
  }
}
