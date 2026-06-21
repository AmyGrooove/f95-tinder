import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

import type { ApplicationConfiguration, NodeEnvironment } from './getConfiguration';

@Injectable()
export class ConfigService {
  constructor(
    private readonly configuration: NestConfigService<
      ApplicationConfiguration,
      true
    >,
  ) {}

  get nodeEnv(): NodeEnvironment {
    return this.configuration.get('nodeEnv', { infer: true });
  }

  get port(): number {
    return this.configuration.get('port', { infer: true });
  }

  get apiPrefix(): string {
    return this.configuration.get('apiPrefix', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.configuration.get('corsOrigins', { infer: true });
  }

  get mongodbUri(): string {
    return this.configuration.get('mongodbUri', { infer: true });
  }

  get redisUrl(): string {
    return this.configuration.get('redisUrl', { infer: true });
  }

  get tokenEncryptionKey(): string {
    return this.configuration.get('tokenEncryptionKey', { infer: true });
  }

  get tokenEncryptionKeyVersion(): string {
    return this.configuration.get('tokenEncryptionKeyVersion', {
      infer: true,
    });
  }

  get catalogSyncCron(): string {
    return this.configuration.get('catalogSyncCron', { infer: true });
  }

  get f95RequestTimeoutMs(): number {
    return this.configuration.get('f95RequestTimeoutMs', { infer: true });
  }

  get redisOptions(): RedisOptions {
    const url = new URL(this.redisUrl);
    const database = url.pathname.slice(1);

    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: database ? Number(database) : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  }
}
