import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { CacheService } from '../cache/cache.service';

export interface HealthStatus {
  status: 'ok';
  services: {
    api: 'up';
    mongodb: 'up';
    redis: 'up';
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cacheService: CacheService,
  ) {}

  async getReadiness(): Promise<HealthStatus> {
    const mongodbReady = this.connection.readyState === 1;
    const redisReady = await this.isRedisReady();

    if (!mongodbReady || !redisReady) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        services: {
          api: 'up',
          mongodb: mongodbReady ? 'up' : 'down',
          redis: redisReady ? 'up' : 'down',
        },
      });
    }

    return {
      status: 'ok',
      services: {
        api: 'up',
        mongodb: 'up',
        redis: 'up',
      },
    };
  }

  private async isRedisReady(): Promise<boolean> {
    try {
      return await this.cacheService.ping();
    } catch {
      return false;
    }
  }
}
