import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { FactModule } from "@entities/fact/fact.module"
import { CacheModule } from "@infrastructure/cache/cache.module"
import { LoggerModule } from "@infrastructure/logger/logger.module"

import { HomeController } from "./controllers/homeController"
import { HomeFeedSchedulerService } from "./services/homeFeedSchedulerService"
import { HomeFeedService } from "./services/homeFeedService"

@Module({
  imports: [CollectionModule, FactModule, CacheModule, LoggerModule],
  controllers: [HomeController],
  providers: [HomeFeedService, HomeFeedSchedulerService],
})
class HomeEndpointModule {}

export { HomeEndpointModule }
