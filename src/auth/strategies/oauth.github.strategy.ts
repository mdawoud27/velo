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
      callbackURL: config.getOrThrow<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): OAuthProfile {
    const emails = profile.emails as GitHubEmail[];

    const primary = emails?.find((e) => e.primary === true && e.verified === true);

    if (!primary?.value) {
      throw new UnauthorizedException(
        'No verified primary email found on this GitHub account. ' +
          'Verify your email in GitHub Settings → Emails and try again.',
      );
    }

    return {
      provider: 'github',
      providerId: String(profile.id),
      email: primary.value,
      name: profile.displayName ?? profile.username ?? '',
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true,
    };
  }
}
