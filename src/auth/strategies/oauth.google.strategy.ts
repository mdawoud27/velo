import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleJson, OAuthProfile } from '../interfaces';
import { resolveOAuthEnv } from '../utils/resolve-oauth-env';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const { clientId, clientSecret, callbackURL } = resolveOAuthEnv({
      provider: 'GOOGLE',
      config,
      perEnvCredentials: false,
    });

    super({
      clientID: clientId,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): OAuthProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google account has no accessible email.');
    }

    const json = profile._json as GoogleJson;
    if (!json.email_verified) {
      throw new UnauthorizedException(
        'Google email address is not verified. Verify it in your Google account and try again.',
      );
    }

    return {
      provider: 'google',
      providerId: profile.id,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true,
    };
  }
}
