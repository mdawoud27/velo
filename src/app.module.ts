import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [PrismaModule, ConfigModule.forRoot({ isGlobal: true }), LoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
