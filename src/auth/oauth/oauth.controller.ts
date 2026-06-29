import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from '../interfaces';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExchangeOAuthCodeDto } from './dtos';

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: 'User login using Google', description: 'User login using Google' })
  @ApiResponse({ status: 302, description: 'Redirect to Google sign in page' })
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @ApiOperation({ summary: 'User login using Google', description: 'User login using Google' })
  @ApiResponse({
    status: 200,
    description: 'Returns tokens JSON when CLIENT_URL is not configured',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend after successful login' })
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@CurrentUser() profile: OAuthProfile, @Res() res: Response) {
    await this.handleOAuthCallback(profile, res);
  }

  @ApiOperation({ summary: 'User login using GitHub', description: 'User login using GitHub' })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub sign in page' })
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {}

  @ApiOperation({ summary: 'User login using GitHub', description: 'User login using GitHub' })
  @ApiResponse({
    status: 200,
    description: 'Returns tokens JSON when CLIENT_URL is not configured',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend after successful login' })
  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@CurrentUser() profile: OAuthProfile, @Res() res: Response) {
    await this.handleOAuthCallback(profile, res);
  }

  @ApiOperation({ summary: 'Exchange OAuth code', description: 'Exchange OAuth code' })
  @ApiResponse({ status: 200, description: 'OAuth code exchanged successfully' })
  @ApiResponse({ status: 401, description: 'OAuth code is invalid or has expired.' })
  @Public()
  @Post('exchange-code')
  exchangeCode(@Body() dto: ExchangeOAuthCodeDto) {
    return this.oauthService.exchangeOAuthCode(dto.code);
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
