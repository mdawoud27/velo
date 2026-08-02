import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('OAuthConfig');

interface ResolveOAuthEnvOptions {
  /** Env var prefix, e.g. 'GOOGLE' or 'GITHUB' */
  provider: 'GOOGLE' | 'GITHUB';
  config: ConfigService;
  /**
   * true  -> separate OAuth app (and client id/secret) per environment
   *          — needed for GitHub, which only allows one callback URL per app.
   * false -> one client id/secret shared across environments, only the
   *          callback URL differs — Google supports multiple redirect URIs
   *          on a single OAuth client.
   */
  perEnvCredentials: boolean;
}

export function resolveOAuthEnv({ provider, config, perEnvCredentials }: ResolveOAuthEnvOptions) {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const suffix = isProduction ? '_PROD' : '_DEV';

  const clientId =
    (perEnvCredentials
      ? config.get<string>(`${provider}_CLIENT_ID${suffix}`)
      : config.get<string>(`${provider}_CLIENT_ID`)) ??
    `unconfigured_${provider.toLowerCase()}_client_id`;

  const clientSecret =
    (perEnvCredentials
      ? config.get<string>(`${provider}_CLIENT_SECRET${suffix}`)
      : config.get<string>(`${provider}_CLIENT_SECRET`)) ??
    `unconfigured_${provider.toLowerCase()}_client_secret`;

  const callbackURL =
    config.get<string>(`${provider}_CALLBACK_URL${suffix}`) ??
    `http://localhost:3000/api/v1/auth/${provider.toLowerCase()}/callback`;

  if (clientId.startsWith('unconfigured_') || clientSecret.startsWith('unconfigured_')) {
    logger.warn(
      `${provider} OAuth is not configured for ${isProduction ? 'production' : 'development'}. ` +
        `Check ${provider}_CLIENT_ID${perEnvCredentials ? suffix : ''} and ` +
        `${provider}_CLIENT_SECRET${perEnvCredentials ? suffix : ''} in your .env.`,
    );
  }

  return { clientId, clientSecret, callbackURL };
}
