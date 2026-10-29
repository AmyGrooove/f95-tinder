import { Module } from "@nestjs/common"

import { CollectionModule } from "@entities/collection/collection.module"
import { ItemCollectionModule } from "@entities/itemCollection/itemCollection.module"
import { ItemModule } from "@entities/item/item.module"
import { UserModule } from "@entities/user/user.module"
import { UserCollectionModule } from "@entities/userCollection/userCollection.module"
import { AuthModule } from "@endpoints/auth/auth.module"
import { DatabaseModule } from "@infrastructure/database/database.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { TagModule } from "@entities/tag/tag.module"
import { TagItemModule } from "@entities/tagItem/tagItem.module"

import { CollectionController } from "./controllers/collection.controller"
import { CollectionUserController } from "./controllers/collectionUser.controller"
import { CollectionReadController } from "./controllers/collectionRead.controller"
import { CollectionService } from "./services/collection.service"
import { CollectionUserService } from "./services/collectionUser.service"
import { CollectionContentService } from "./services/collectionContent.service"
import { CollectionAuthService } from "./services/collectionAuth.service"
import { TagCollectionsInitializationService } from "./services/tagCollectionsInitialization.service"
import { TagCollectionsSynchronizationService } from "./services/tagCollectionsSynchronization.service"
import { SynchronizeTagCollectionsJobHandler } from "./handlers/synchronizeTagCollectionsJob.handler"

@Module({
  imports: [
    CollectionModule,
    ItemCollectionModule,
    ItemModule,
    UserModule,
    UserCollectionModule,
    AuthModule,
    DatabaseModule,
    JobsModule,
    TagModule,
    TagItemModule,
  ],
  controllers: [
    CollectionController,
    CollectionUserController,
    CollectionReadController,
  ],
  providers: [
    CollectionAuthService,
    CollectionService,
    CollectionUserService,
    CollectionContentService,
    TagCollectionsInitializationService,
    TagCollectionsSynchronizationService,
    SynchronizeTagCollectionsJobHandler,
  ],
})
class CollectionEndpointModule {}

export { CollectionEndpointModule }
