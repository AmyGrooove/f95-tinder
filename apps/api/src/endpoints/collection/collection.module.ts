import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { CollectionItemModule } from "@entities/collectionItem/collectionItem.module"
import { ItemModule } from "@entities/item/item.module"
import { UserModule } from "@entities/user/user.module"
import { UserCollectionModule } from "@entities/userCollection/userCollection.module"
import { AuthModule } from "@endpoints/auth"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { CollectionController } from "./controllers/collection.controller"
import { CollectionUserController } from "./controllers/collectionUser.controller"
import { CollectionService } from "./services/collection.service"
import { CollectionUserService } from "./services/collectionUser.service"

@Module({
  imports: [
    CollectionModule,
    CollectionItemModule,
    ItemModule,
    UserModule,
    UserCollectionModule,
    AuthModule,
    DatabaseModule,
  ],
  controllers: [CollectionController, CollectionUserController],
  providers: [CollectionService, CollectionUserService],
})
class CollectionEndpointModule {}

export { CollectionEndpointModule }
