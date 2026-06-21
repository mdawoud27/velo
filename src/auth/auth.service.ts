import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RegistrationDto, VerifyEmailDto } from './dtos';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  EmailAlreadyRegisteredException,
  InvalidOrExpiredTokenException,
} from 'src/common/exceptions';
import { EmailQueueService } from 'src/queue/email-queue.service';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
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
    console.warn('verifcation-token:', redisKey, userId);

    return { message: 'Email verified successfully' };
  }
}
