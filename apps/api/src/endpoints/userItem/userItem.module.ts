import { ItemTagModule } from "@entities/itemTag/itemTag.module"
import { Module } from "@nestjs/common"

import { AuthModule } from "@endpoints/auth/auth.module"
import { ItemModule } from "@entities/item/item.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { UserModule } from "@entities/user/user.module"
import { UserTasteProfileModule } from "@entities/userTasteProfile/userTasteProfile.module"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { UserItemController } from "./controllers/userItem.controller"
import { UserItemService } from "./services/userItem.service"

@Module({
  imports: [
    AuthModule,
    ItemModule,
    ItemTagModule,
    UserItemModule,
    UserModule,
    UserTasteProfileModule,
    DatabaseModule,
  ],
  controllers: [UserItemController],
  providers: [UserItemService],
})
class UserItemEndpointModule {}

export { UserItemEndpointModule }
