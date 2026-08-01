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
  @ApiDataResponse(AuthTokensDto, 'Returns tokens directly when FRONTEND_URL is not set')
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
  @ApiDataResponse(AuthTokensDto, 'Returns tokens directly when FRONTEND_URL is not set')
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
    try {
      const tokens = await this.oauthService.handleOAuthLogin(profile);
      const code = await this.oauthService.storeOAuthCode(tokens);
      const frontendUrl = this.config.get<string>('FRONTEND_URL');

      // If a real frontend is configured, redirect there with the code
      if (frontendUrl) {
        return res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
      }

      // Otherwise redirect to the API landing page with result
      const params = new URLSearchParams({
        code,
        provider: profile.provider,
      });
      if (profile.name) params.set('name', profile.name);

      res.redirect(`/?${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth login failed';
      const frontendUrl = this.config.get<string>('FRONTEND_URL');

      if (frontendUrl) {
        return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`);
      }

      res.redirect(`/?oauth_error=${encodeURIComponent(message)}`);
    }
  }
}
