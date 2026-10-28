import { Module } from "@nestjs/common"

import { ItemModule } from "@entities/item/item.module"
import { UserModule } from "@entities/user/user.module"
import { CollectionModule } from "@entities/collection/collection.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"
import { SearchModule } from "@infrastructure/search/search.module"

import { SearchController } from "./controllers/search.controller"
import { SyncSearchJobHandler } from "./handlers/syncSearchJob.handler"
import { SiteSearchService } from "./services/siteSearch.service"
import { SearchSyncSchedulerService } from "./services/searchSyncScheduler.service"

@Module({
  imports: [
    ItemModule,
    UserModule,
    CollectionModule,
    CacheModule,
    JobsModule,
    LoggerModule,
    SchedulerModule,
    SearchModule,
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
