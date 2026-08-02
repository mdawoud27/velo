import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { GitHubEmail, OAuthProfile } from '../interfaces';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') || 'unconfigured_github_client_id',
      clientSecret:
        config.get<string>('GITHUB_CLIENT_SECRET') || 'unconfigured_github_client_secret',
      callbackURL:
        config.get<string>('GITHUB_CALLBACK_URL') ||
        (config.get<string>('NODE_ENV') === 'production'
          ? config.get<string>('GITHUB_CALLBACK_URL_PROD') ||
            'http://localhost:3000/api/v1/auth/github/callback'
          : 'http://localhost:3000/api/v1/auth/github/callback'),
      scope: ['user:email'],
      allRawEmails: true,
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): OAuthProfile {
    const emails = profile.emails as GitHubEmail[];

    const email =
      emails?.find((e) => e.primary === true && e.verified === true)?.value ??
      emails?.find((e) => e.verified === true)?.value;

    if (!email) {
      throw new UnauthorizedException(
        'No verified email found on this GitHub account. ' +
          'Verify your email in GitHub Settings → Emails and try again.',
      );
    }

    return {
      provider: 'github',
      providerId: String(profile.id),
      email,
      name: profile.displayName ?? profile.username ?? '',
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true,
    };
  }
}
