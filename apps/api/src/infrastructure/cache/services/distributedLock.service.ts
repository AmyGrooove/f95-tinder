import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CacheService } from '../cache.service';

export interface DistributedLock {
  key: string;
  owner: string;
}

@Injectable()
export class DistributedLockService {
  constructor(private readonly cacheService: CacheService) {}

  async acquire(
    key: string,
    ttlMilliseconds: number,
  ): Promise<DistributedLock | null> {
    const owner = randomUUID();
    const acquired = await this.cacheService.acquireLock(
      key,
      owner,
      ttlMilliseconds,
    );

    return acquired ? { key, owner } : null;
  }

  release(lock: DistributedLock): Promise<boolean> {
    return this.cacheService.releaseLock(lock.key, lock.owner);
  }

  refresh(
    lock: DistributedLock,
    ttlMilliseconds: number,
  ): Promise<boolean> {
    return this.cacheService.refreshLock(
      lock.key,
      lock.owner,
      ttlMilliseconds,
    );
  }
}
