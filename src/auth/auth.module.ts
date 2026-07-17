import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { QueueModule } from 'src/queue/queue.module';
import { TokensService } from './tokens.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { jwtModuleAsyncOptions } from './jwt.config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync(jwtModuleAsyncOptions),
    forwardRef(() => QueueModule),
    forwardRef(() => RealtimeModule),
    NotificationsModule,
  ],
  providers: [JwtStrategy, AuthService, TokensService],
  controllers: [AuthController],
  exports: [JwtModule, AuthService, TokensService],
})
export class AuthModule {}
