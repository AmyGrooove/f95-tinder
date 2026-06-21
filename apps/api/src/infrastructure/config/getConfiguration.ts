export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ApplicationConfiguration {
  nodeEnv: NodeEnvironment;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  mongodbUri: string;
  redisUrl: string;
  tokenEncryptionKey: string;
  tokenEncryptionKeyVersion: string;
  catalogSyncCron: string;
  f95RequestTimeoutMs: number;
}

type Environment = Record<string, string | undefined>;

function requireValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const nodeEnv = value ?? 'development';

  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  return nodeEnv;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  const parsed = Number(value ?? defaultValue);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseApiPrefix(value: string): string {
  const prefix = value.replace(/^\/+|\/+$/g, '');

  if (!prefix) {
    throw new Error('API_PREFIX must contain at least one non-slash character');
  }

  return prefix;
}

function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one origin');
  }

  return origins;
}

function validateUrl(value: string, name: string, protocols: string[]): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} must use one of: ${protocols.join(', ')}`);
  }

  return value;
}

function validateEncryptionKey(value: string): string {
  const decoded = Buffer.from(value, 'base64');

  if (decoded.length !== 32 || decoded.toString('base64') !== value) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key');
  }

  return value;
}

function validateCron(value: string): string {
  const fields = value.split(/\s+/);

  if (fields.length !== 5) {
    throw new Error('CATALOG_SYNC_CRON must contain five cron fields');
  }

  return value;
}

export function getConfiguration(environment: Environment): ApplicationConfiguration {
  return {
    nodeEnv: parseNodeEnvironment(environment.NODE_ENV),
    port: parsePort(environment.PORT),
    apiPrefix: parseApiPrefix(requireValue(environment, 'API_PREFIX')),
    corsOrigins: parseCorsOrigins(requireValue(environment, 'CORS_ORIGINS')),
    mongodbUri: validateUrl(
      requireValue(environment, 'MONGODB_URI'),
      'MONGODB_URI',
      ['mongodb:', 'mongodb+srv:'],
    ),
    redisUrl: validateUrl(
      requireValue(environment, 'REDIS_URL'),
      'REDIS_URL',
      ['redis:', 'rediss:'],
    ),
    tokenEncryptionKey: validateEncryptionKey(
      requireValue(environment, 'TOKEN_ENCRYPTION_KEY'),
    ),
    tokenEncryptionKeyVersion: requireValue(
      environment,
      'TOKEN_ENCRYPTION_KEY_VERSION',
    ),
    catalogSyncCron: validateCron(
      requireValue(environment, 'CATALOG_SYNC_CRON'),
    ),
    f95RequestTimeoutMs: parsePositiveInteger(
      environment.F95_REQUEST_TIMEOUT_MS,
      30_000,
      'F95_REQUEST_TIMEOUT_MS',
    ),
  };
}
