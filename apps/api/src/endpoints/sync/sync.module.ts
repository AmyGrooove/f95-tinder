import { Module } from "@nestjs/common"

import { CreatorModule } from "@entities/creator/creator.module"
import { GameModule } from "@entities/game/game.module"
import { PrefixModule } from "@entities/prefix/prefix.module"
import { TagModule } from "@entities/tag/tag.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { F95ClientModule } from "@infrastructure/f95Client/f95.module"
import { SecurityModule } from "@infrastructure/security/security.module"

import { AuthPrincipalModule } from "../auth/authPrincipal.module"
import { SyncController } from "./controllers/sync.controller"
import { CatalogSyncCron } from "./crons/catalogSync.cron"
import { CatalogSeedService } from "./services/catalogSeed.service"
import { CatalogSyncControlService } from "./services/catalogSyncControl.service"
import { CatalogSyncRunnerService } from "./services/catalogSyncRunner.service"
import { CatalogSyncService } from "./services/catalogSync.service"
import { CatalogSyncStatusService } from "./services/catalogSyncStatus.service"

@Module({
  imports: [
    CacheModule,
    CreatorModule,
    F95ClientModule,
    GameModule,
    PrefixModule,
    SecurityModule,
    TagModule,
    AuthPrincipalModule,
  ],
  controllers: [SyncController],
  providers: [
    CatalogSeedService,
    CatalogSyncControlService,
    CatalogSyncRunnerService,
    CatalogSyncService,
    CatalogSyncStatusService,
    CatalogSyncCron,
  ],
  exports: [CatalogSyncService, CatalogSyncStatusService],
})
class SyncModule {}

export { SyncModule }
