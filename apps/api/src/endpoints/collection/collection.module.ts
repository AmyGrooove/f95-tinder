import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { CollectionItemModule } from "@entities/collectionItem/collectionItem.module"
import { ItemModule } from "@entities/item/item.module"
import { UserModule } from "@entities/user/user.module"
import { AuthModule } from "@endpoints/auth"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { CollectionController } from "./controllers/collection.controller"
import { CollectionService } from "./services/collection.service"

@Module({
  imports: [
    CollectionModule,
    CollectionItemModule,
    ItemModule,
    UserModule,
    AuthModule,
    DatabaseModule,
  ],
  controllers: [CollectionController],
  providers: [CollectionService],
})
class CollectionEndpointModule {}

export { CollectionEndpointModule }
