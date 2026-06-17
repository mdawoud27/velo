import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './logger/logger.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [PrismaModule, ConfigModule.forRoot({ isGlobal: true }), LoggerModule, RedisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
