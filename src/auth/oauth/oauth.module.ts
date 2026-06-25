import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { GithubStrategy, GoogleStrategy } from '../strategies';

@Module({
  imports: [PassportModule, AuthModule],
  controllers: [OAuthController],
  providers: [OAuthService, GoogleStrategy, GithubStrategy],
})
export class OAuthModule {}
