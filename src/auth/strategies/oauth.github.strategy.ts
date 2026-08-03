import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { GitHubEmail, OAuthProfile } from '../interfaces';
import { resolveOAuthEnv } from '../utils/resolve-oauth-env';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    const { clientId, clientSecret, callbackURL } = resolveOAuthEnv({
      provider: 'GITHUB',
      config,
      perEnvCredentials: true,
    });

    super({
      clientID: clientId,
      clientSecret,
      callbackURL,
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
