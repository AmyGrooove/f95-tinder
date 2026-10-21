import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Collection, CollectionSchema } from "./schemas/collection.schema"
import { CollectionRepository } from "./services/collection.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
    ]),
  ],
  providers: [CollectionRepository],
  exports: [CollectionRepository],
})
class CollectionModule {}

export { CollectionModule }
