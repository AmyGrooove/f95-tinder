import { TagItemModule } from "@entities/tagItem/tagItem.module"
import { Module } from "@nestjs/common"
import { RedisModule } from "@nestjs-redis/client"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemStatsModule } from "@entities/itemStats/itemStats.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { ItemModule } from "@entities/item/item.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserActivityModule } from "@entities/userActivity/userActivity.module"
import { UserModule } from "@entities/user/user.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"

import { UserItemController } from "@endpoints/userItem/controllers/userItemController"
import { UserItemService } from "@endpoints/userItem/services/userItemService"
import { UserItemEventsService } from "@endpoints/userItem/services/userItemEventsService"
import { UserItemStatsService } from "@endpoints/userItem/services/userItemStatsService"
import { LibraryActivityService } from "@endpoints/userItem/services/libraryActivityService"

@Module({
  imports: [
    AuthModule,
    ItemStatsModule,
    SiteStatsModule,
    ItemModule,
    TagItemModule,
    UserItemModule,
    UserActivityModule,
    UserModule,
    DatabaseModule,
    InfrastructureConfigModule,
    LoggerModule,
    SchedulerModule,
    RedisModule.forRootAsync({
      connectionName: "libraryActivity",
      imports: [InfrastructureConfigModule],
      inject: [InfrastructureConfigService],
      useFactory: (configuration: InfrastructureConfigService) => ({
        options: {
          url: configuration.redis.url,
          commandOptions: { timeout: 5_000 },
        },
      }),
    }),
  ],
  controllers: [UserItemController],
  providers: [
    UserItemService,
    UserItemEventsService,
    UserItemStatsService,
    LibraryActivityService,
  ],
  exports: [UserItemService],
})
class UserItemEndpointModule {}

export { UserItemEndpointModule }
