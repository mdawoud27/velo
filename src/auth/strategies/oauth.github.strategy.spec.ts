import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { GithubStrategy } from './oauth.github.strategy';

function makeConfig() {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'GITHUB_CLIENT_ID_DEV') return 'gh_id';
      if (key === 'GITHUB_CLIENT_SECRET_DEV') return 'gh_secret';
      if (key === 'GITHUB_CALLBACK_URL_DEV') return 'http://localhost:3000/callback';
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('GithubStrategy', () => {
  let strategy: GithubStrategy;

  beforeEach(() => {
    strategy = new GithubStrategy(makeConfig());
  });

  it('validates and returns OAuthProfile for a primary verified email', () => {
    const profile = {
      id: '12345',
      displayName: 'Alice',
      username: 'alice',
      emails: [{ value: 'alice@example.com', primary: true, verified: true }],
      photos: [{ value: 'https://avatar.url' }],
    } as any;

    const result = strategy.validate('access', 'refresh', profile);

    expect(result).toEqual({
      provider: 'github',
      providerId: '12345',
      email: 'alice@example.com',
      name: 'Alice',
      avatarUrl: 'https://avatar.url',
      emailVerified: true,
    });
  });

  it('throws UnauthorizedException when no verified email is present', () => {
    const profile = {
      id: '12345',
      emails: [{ value: 'unverified@example.com', primary: true, verified: false }],
    } as any;

    expect(() => strategy.validate('access', 'refresh', profile)).toThrow(UnauthorizedException);
  });
});
