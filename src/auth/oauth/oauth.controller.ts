import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from '../interfaces';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators';

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@CurrentUser() profile: OAuthProfile, @Res() res: Response) {
    await this.handleOAuthCallback(profile, res);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {}

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@CurrentUser() profile: OAuthProfile, @Res() res: Response) {
    await this.handleOAuthCallback(profile, res);
  }

  private async handleOAuthCallback(profile: OAuthProfile, res: Response) {
    const { accessToken, refreshToken } = await this.oauthService.handleOAuthLogin(profile);

    const clientUrl = this.config.get<string>('CLIENT_URL');
    if (!clientUrl || clientUrl === '') {
      res.json({
        message: 'OAuth Login Successful!',
        accessToken,
        refreshToken,
      });
      return;
    }

    res.redirect(`${clientUrl}/auth/callback?token=${accessToken}`);
  }
}
