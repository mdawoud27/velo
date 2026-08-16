import { ConfigService } from '@nestjs/config';
import { resolveOAuthEnv } from './resolve-oauth-env';

function makeConfig(envMap: Record<string, string> = {}) {
  return {
    get: jest.fn().mockImplementation((key: string) => envMap[key]),
  } as unknown as ConfigService;
}

describe('resolveOAuthEnv', () => {
  it('resolves development env variables for GITHUB when perEnvCredentials is true', () => {
    const config = makeConfig({
      NODE_ENV: 'development',
      GITHUB_CLIENT_ID_DEV: 'gh_dev_id',
      GITHUB_CLIENT_SECRET_DEV: 'gh_dev_secret',
      GITHUB_CALLBACK_URL_DEV: 'http://localhost:3000/callback',
    });

    const result = resolveOAuthEnv({ provider: 'GITHUB', config, perEnvCredentials: true });

    expect(result).toEqual({
      clientId: 'gh_dev_id',
      clientSecret: 'gh_dev_secret',
      callbackURL: 'http://localhost:3000/callback',
    });
  });

  it('resolves production env variables for GITHUB when perEnvCredentials is true', () => {
    const config = makeConfig({
      NODE_ENV: 'production',
      GITHUB_CLIENT_ID_PROD: 'gh_prod_id',
      GITHUB_CLIENT_SECRET_PROD: 'gh_prod_secret',
      GITHUB_CALLBACK_URL_PROD: 'https://api.example.com/callback',
    });

    const result = resolveOAuthEnv({ provider: 'GITHUB', config, perEnvCredentials: true });

    expect(result).toEqual({
      clientId: 'gh_prod_id',
      clientSecret: 'gh_prod_secret',
      callbackURL: 'https://api.example.com/callback',
    });
  });

  it('resolves shared credentials for GOOGLE when perEnvCredentials is false', () => {
    const config = makeConfig({
      NODE_ENV: 'development',
      GOOGLE_CLIENT_ID: 'google_id',
      GOOGLE_CLIENT_SECRET: 'google_secret',
      GOOGLE_CALLBACK_URL_DEV: 'http://localhost:3000/google/callback',
    });

    const result = resolveOAuthEnv({ provider: 'GOOGLE', config, perEnvCredentials: false });

    expect(result).toEqual({
      clientId: 'google_id',
      clientSecret: 'google_secret',
      callbackURL: 'http://localhost:3000/google/callback',
    });
  });

  it('provides unconfigured fallback values when env vars are missing', () => {
    const config = makeConfig({});

    const result = resolveOAuthEnv({ provider: 'GITHUB', config, perEnvCredentials: true });

    expect(result.clientId).toContain('unconfigured_github');
    expect(result.clientSecret).toContain('unconfigured_github');
    expect(result.callbackURL).toContain('/api/v1/auth/github/callback');
  });
});
