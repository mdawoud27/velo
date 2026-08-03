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
import { LoggerService } from 'src/logger/logger.service';

@ApiTags('Auth')
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
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
  @ApiRedirectResponse(
    'Redirects to FRONTEND_URL/auth/callback?code=... if configured, otherwise to the API landing page with a code query param. Exchange the code via POST /auth/exchange-code to get tokens.',
  )
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
  @ApiRedirectResponse(
    'Redirects to FRONTEND_URL/auth/callback?code=... if configured, otherwise to the API landing page with a code query param. Exchange the code via POST /auth/exchange-code to get tokens.',
  )
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

      // Otherwise redirect to the API landing page with result.
      // No display name here: query strings end up in access logs, browser
      // history, and Referer headers, and the frontend can already read the
      // email straight off the exchanged token's JWT payload.
      const params = new URLSearchParams({
        code,
        provider: profile.provider,
      });

      res.redirect(`/?${params.toString()}`);
    } catch (error: unknown) {
      // Log the full error server-side; never forward internal error text
      // to the browser via a query string.
      this.logger.error(
        'OAuth login failed',
        error instanceof Error ? error : undefined,
        OAuthController.name,
      );

      const errorCode = 'oauth_login_failed';
      const frontendUrl = this.config.get<string>('FRONTEND_URL');

      if (frontendUrl) {
        return res.redirect(`${frontendUrl}/auth/callback?error=${errorCode}`);
      }

      res.redirect(`/?oauth_error=${errorCode}`);
    }
  }
}
