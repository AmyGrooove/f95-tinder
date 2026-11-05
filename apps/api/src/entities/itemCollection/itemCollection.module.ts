import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  ItemCollection,
  ItemCollectionSchema,
} from "./schemas/itemCollection.schema"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemCollection.name, schema: ItemCollectionSchema },
    ]),
  ],
  providers: [ItemCollectionRepository],
  exports: [ItemCollectionRepository],
})
class ItemCollectionModule {}

export { ItemCollectionModule }
