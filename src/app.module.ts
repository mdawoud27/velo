import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './logger/logger.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { BanGuard, JwtAuthGuard } from './auth/guards';
import { OAuthModule } from './auth/oauth/oauth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    RedisModule,
    HealthModule,
    QueueModule,
    MailModule,
    AuthModule,
    OAuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: BanGuard },
  ],
})
export class AppModule {}
