import { Module } from "@nestjs/common"

import { ItemModule } from "@entities/item/item.module"
import { ItemCollectionModule } from "@entities/itemCollection/itemCollection.module"
import { ItemStatsModule } from "@entities/itemStats/itemStats.module"
import { UserModule } from "@entities/user/user.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserCollectionModule } from "@entities/userCollection/userCollection.module"
import { CollectionModule } from "@entities/collection/collection.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { TagModule } from "@entities/tag/tag.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"
import { SearchModule } from "@infrastructure/search/search.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { SearchController } from "@endpoints/search/controllers/searchController"
import { SyncSearchJobHandler } from "@endpoints/search/services/syncSearchJobHandler"
import { SiteSearchService } from "@endpoints/search/services/siteSearchService"
import { SearchSyncSchedulerService } from "@endpoints/search/services/searchSyncSchedulerService"
import { AuthModule } from "@endpoints/auth/auth.module"

@Module({
  imports: [
    AuthModule,
    ItemModule,
    ItemCollectionModule,
    ItemStatsModule,
    UserModule,
    UserItemModule,
    UserCollectionModule,
    CollectionModule,
    SiteStatsModule,
    TagModule,
    CacheModule,
    JobsModule,
    LoggerModule,
    SchedulerModule,
    SearchModule,
    StorageModule,
  ],
  controllers: [SearchController],
  providers: [
    SiteSearchService,
    SearchSyncSchedulerService,
    SyncSearchJobHandler,
  ],
})
class SearchEndpointModule {}

export { SearchEndpointModule }
