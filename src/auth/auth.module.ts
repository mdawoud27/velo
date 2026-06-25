import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { QueueModule } from 'src/queue/queue.module';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<number>('JWT_ACCESS_EXPIRES_IN'),
        },
      }),
    }),
    QueueModule,
  ],
  providers: [JwtStrategy, AuthService, TokensService],
  controllers: [AuthController],
  exports: [JwtModule, AuthService, TokensService],
})
export class AuthModule {}
