import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from './oauth.google.strategy';

function makeConfig() {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'google_id';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'google_secret';
      if (key === 'GOOGLE_CALLBACK_URL_DEV') return 'http://localhost:3000/callback';
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    strategy = new GoogleStrategy(makeConfig());
  });

  it('validates and returns OAuthProfile for verified Google email', () => {
    const profile = {
      id: 'g-12345',
      displayName: 'Bob',
      emails: [{ value: 'bob@example.com' }],
      photos: [{ value: 'https://avatar.url' }],
      _json: { email_verified: true },
    } as any;

    const result = strategy.validate('access', 'refresh', profile);

    expect(result).toEqual({
      provider: 'google',
      providerId: 'g-12345',
      email: 'bob@example.com',
      name: 'Bob',
      avatarUrl: 'https://avatar.url',
      emailVerified: true,
    });
  });

  it('throws UnauthorizedException when email_verified is false', () => {
    const profile = {
      id: 'g-12345',
      emails: [{ value: 'bob@example.com' }],
      _json: { email_verified: false },
    } as any;

    expect(() => strategy.validate('access', 'refresh', profile)).toThrow(UnauthorizedException);
  });
});
