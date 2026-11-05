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

import { CollectionController } from "@endpoints/collection/controllers/collectionController"
import { CollectionUserController } from "@endpoints/collection/controllers/collectionUserController"
import { CollectionReadController } from "@endpoints/collection/controllers/collectionReadController"
import { CollectionService } from "@endpoints/collection/services/collectionService"
import { CollectionUserService } from "@endpoints/collection/services/collectionUserService"
import { CollectionContentService } from "@endpoints/collection/services/collectionContentService"
import { CollectionAuthService } from "@endpoints/collection/services/collectionAuthService"
import { TagCollectionsInitializationService } from "@endpoints/collection/services/tagCollectionsInitializationService"
import { TagCollectionsSynchronizationService } from "@endpoints/collection/services/tagCollectionsSynchronizationService"
import { SynchronizeTagCollectionsJobHandler } from "@endpoints/collection/services/synchronizeTagCollectionsJobHandler"

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
