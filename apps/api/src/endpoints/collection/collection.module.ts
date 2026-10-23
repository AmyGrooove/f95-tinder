import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { CollectionItemModule } from "@entities/collectionItem/collectionItem.module"
import { ItemModule } from "@entities/item/item.module"
import { FeatureModule } from "@entities/feature/feature.module"
import { UserModule } from "@entities/user/user.module"
import { UserCollectionModule } from "@entities/userCollection/userCollection.module"
import { AuthModule } from "@endpoints/auth/auth.module"
import { DatabaseModule } from "@infrastructure/database/database.module"

import { CollectionController } from "./controllers/collection.controller"
import { CollectionUserController } from "./controllers/collectionUser.controller"
import { CollectionReadController } from "./controllers/collectionRead.controller"
import { CollectionService } from "./services/collection.service"
import { CollectionUserService } from "./services/collectionUser.service"
import { CollectionContentService } from "./services/collectionContent.service"

@Module({
  imports: [
    CollectionModule,
    CollectionItemModule,
    ItemModule,
    FeatureModule,
    UserModule,
    UserCollectionModule,
    AuthModule,
    DatabaseModule,
  ],
  controllers: [
    CollectionController,
    CollectionUserController,
    CollectionReadController,
  ],
  providers: [
    CollectionService,
    CollectionUserService,
    CollectionContentService,
  ],
})
class CollectionEndpointModule {}

export { CollectionEndpointModule }
