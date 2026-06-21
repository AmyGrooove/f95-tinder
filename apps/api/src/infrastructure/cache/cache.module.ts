import { Global, Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { CacheService } from './cache.service';
import { DistributedLockService } from './services/distributedLock.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService, DistributedLockService],
  exports: [CacheService, DistributedLockService],
})
export class CacheModule {}
