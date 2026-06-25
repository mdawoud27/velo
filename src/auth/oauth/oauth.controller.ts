import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
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

  @Public()
  @Post('exchange-code')
  exchangeCode(@Body('code') code: string) {
    return this.oauthService.exchangeOAuthCode(code);
  }

  private async handleOAuthCallback(profile: OAuthProfile, res: Response) {
    const tokens = await this.oauthService.handleOAuthLogin(profile);
    const clientUrl = this.config.get<string>('CLIENT_URL');

    // No CLIENT_URL: dev/test mode
    if (!clientUrl || clientUrl === '') {
      res.json({ message: 'OAuth Login Successful!', ...tokens });
      return;
    }

    // Production: redirect with a 60-second one-time code
    const code = await this.oauthService.storeOAuthCode(tokens);
    res.redirect(`${clientUrl}/auth/callback?code=${code}`);
  }
}
