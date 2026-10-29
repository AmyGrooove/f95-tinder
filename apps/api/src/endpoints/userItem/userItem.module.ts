import { TagItemModule } from "@entities/tagItem/tagItem.module"
import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemStatsModule } from "@entities/itemStats/itemStats.module"
import { SiteStatsModule } from "@entities/siteStats/siteStats.module"
import { ItemModule } from "@entities/item/item.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserModule } from "@entities/user/user.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { UserItemController } from "./controllers/userItem.controller"
import { UserItemService } from "./services/userItem.service"
import { UserItemStatsService } from "./services/userItemStats.service"

@Module({
  imports: [
    AuthModule,
    ItemStatsModule,
    SiteStatsModule,
    ItemModule,
    TagItemModule,
    UserItemModule,
    UserModule,
    UserTasteProfileModule,
    DatabaseModule,
  ],
  controllers: [UserItemController],
  providers: [UserItemService, UserItemStatsService],
})
class UserItemEndpointModule {}

export { UserItemEndpointModule }
