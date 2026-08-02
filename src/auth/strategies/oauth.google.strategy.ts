import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleJson, OAuthProfile } from '../interfaces';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'unconfigured_google_client_id',
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET') || 'unconfigured_google_client_secret',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ||
        (config.get<string>('NODE_ENV') === 'production'
          ? config.get<string>('GOOGLE_CALLBACK_URL_PROD') ||
            'http://localhost:3000/api/v1/auth/google/callback'
          : 'http://localhost:3000/api/v1/auth/google/callback'),
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
