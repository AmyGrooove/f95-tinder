import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  CollectionItem,
  CollectionItemSchema,
} from "./schemas/collectionItem.schema"
import { CollectionItemRepository } from "./services/collectionItem.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CollectionItem.name, schema: CollectionItemSchema },
    ]),
  ],
  providers: [CollectionItemRepository],
  exports: [CollectionItemRepository],
})
class CollectionItemModule {}

export { CollectionItemModule }
