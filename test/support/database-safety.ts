const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'postgres']);

function isTestDatabaseName(pathname: string): boolean {
  const databaseName = pathname.replace(/^\//, '').toLowerCase();
  return databaseName.includes('test');
}

export function assertSafeTestDatabaseUrl(databaseUrl = process.env.DATABASE_URL): void {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before running e2e tests.');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  const allowExplicitReset = process.env.ALLOW_E2E_DB_RESET === 'true';
  const isLocalHost = LOCAL_DATABASE_HOSTS.has(parsed.hostname);
  const isTestDatabase = isTestDatabaseName(parsed.pathname);

  if (!allowExplicitReset && (!isLocalHost || !isTestDatabase)) {
    throw new Error(
      [
        'Refusing to reset a non-local or non-test database during e2e tests.',
        `Host: ${parsed.hostname || '(missing)'}`,
        `Database: ${parsed.pathname.replace(/^\//, '') || '(missing)'}`,
        'Set TEST_DATABASE_URL to a local database whose name contains "test".',
      ].join(' '),
    );
  }
}
