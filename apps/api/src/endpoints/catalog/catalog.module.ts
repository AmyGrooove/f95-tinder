import { Module } from '@nestjs/common';

import { GameModule } from '../../entities/game/game.module';
import { SyncStateModule } from '../../entities/syncState/syncState.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { JobsModule } from '../../infrastructure/jobs/jobs.module';
import { CatalogSyncProcessor } from '../../infrastructure/jobs/processors/catalogSync.processor';
import { CatalogSyncScheduler } from '../../infrastructure/scheduler/catalogSync.scheduler';
import { F95Module } from '../../integrations/f95/f95.module';
import { CatalogSyncController } from './controllers/catalogSync.controller';
import { CatalogSyncProgressService } from './services/catalogSyncProgress.service';
import { CatalogSyncService } from './services/catalogSync.service';

@Module({
  imports: [
    GameModule,
    SyncStateModule,
    F95Module,
    CacheModule,
    JobsModule,
  ],
  controllers: [CatalogSyncController],
  providers: [
    CatalogSyncService,
    CatalogSyncProgressService,
    CatalogSyncProcessor,
    CatalogSyncScheduler,
  ],
})
export class CatalogModule {}
