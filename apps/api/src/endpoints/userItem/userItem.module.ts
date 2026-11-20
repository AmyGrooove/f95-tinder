import { TagItemModule } from "@entities/tagItem/tagItem.module"
import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemStatsModule } from "@entities/itemStats/itemStats.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { ItemModule } from "@entities/item/item.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserItemHistoryModule } from "@entities/userItemHistory/userItemHistory.module"
import { UserModule } from "@entities/user/user.module"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { UserItemController } from "@endpoints/userItem/controllers/userItemController"
import { UserItemService } from "@endpoints/userItem/services/userItemService"
import { UserItemStatsService } from "@endpoints/userItem/services/userItemStatsService"

@Module({
  imports: [
    AuthModule,
    ItemStatsModule,
    SiteStatsModule,
    ItemModule,
    TagItemModule,
    UserItemModule,
    UserItemHistoryModule,
    UserModule,
    DatabaseModule,
  ],
  controllers: [UserItemController],
  providers: [UserItemService, UserItemStatsService],
  exports: [UserItemService],
})
class UserItemEndpointModule {}

export { UserItemEndpointModule }
