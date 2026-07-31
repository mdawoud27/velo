import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { OAuthProfile } from '../interfaces';

interface GitHubEmail {
  value: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL:
        config.get<string>('NODE_ENV') === 'production'
          ? config.getOrThrow<string>('GITHUB_CALLBACK_URL_PROD')
          : config.getOrThrow<string>('GITHUB_CALLBACK_URL'),
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
