import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from '../interfaces';
import { CurrentUser, Public } from '../decorators';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExchangeOAuthCodeDto } from './dtos';
import { ApiDataResponse, ApiErrorResponses, ApiRedirectResponse } from 'src/common/decorators';
import { AuthTokensDto } from '../dtos';

@ApiTags('Auth')
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiRedirectResponse('Redirects to Google sign-in page')
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiRedirectResponse('Redirects to frontend after successful login')
  @ApiDataResponse(AuthTokensDto, 'Returns tokens directly when CLIENT_URL is not set')
  async googleCallback(@CurrentUser() profile: OAuthProfile, @Res() res: Response) {
    await this.handleOAuthCallback(profile, res);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  @ApiRedirectResponse('Redirects to GitHub sign-in page')
  githubAuth() {}

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @ApiRedirectResponse('Redirects to frontend after successful login')
  @ApiDataResponse(AuthTokensDto, 'Returns tokens directly when CLIENT_URL is not set')
  async githubCallback(@CurrentUser() profile: OAuthProfile, @Res() res: Response) {
    await this.handleOAuthCallback(profile, res);
  }

  @Public()
  @Post('exchange-code')
  @ApiOperation({ summary: 'Exchange one-time OAuth code for tokens' })
  @ApiDataResponse(AuthTokensDto, 'OAuth code exchanged successfully')
  @ApiErrorResponses(401)
  exchangeCode(@Body() dto: ExchangeOAuthCodeDto) {
    return this.oauthService.exchangeOAuthCode(dto.code);
  }

  private async handleOAuthCallback(profile: OAuthProfile, res: Response) {
    const tokens = await this.oauthService.handleOAuthLogin(profile);
    const clientUrl = this.config.get<string>('CLIENT_URL');

    if (!clientUrl || clientUrl === '') {
      res.json({ message: 'OAuth Login Successful!', ...tokens });
      return;
    }

    const code = await this.oauthService.storeOAuthCode(tokens);
    res.redirect(`${clientUrl}/auth/callback?code=${code}`);
  }
}
