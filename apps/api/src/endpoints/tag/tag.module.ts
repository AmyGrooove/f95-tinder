import { Module } from "@nestjs/common"

import { TagModule } from "@entities/tag/tag.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"
import { SearchModule } from "@infrastructure/search/search.module"

import { TagController } from "./controllers/tagController"
import { SyncTagSearchJobHandler } from "./services/syncTagSearchJobHandler"
import { TagSearchSchedulerService } from "./services/tagSearchSchedulerService"
import { TagSearchService } from "./services/tagSearchService"

@Module({
  imports: [
    TagModule,
    CacheModule,
    JobsModule,
    LoggerModule,
    SchedulerModule,
    SearchModule,
  ],
  controllers: [TagController],
  providers: [
    TagSearchService,
    TagSearchSchedulerService,
    SyncTagSearchJobHandler,
  ],
})
class TagEndpointModule {}

export { TagEndpointModule }
