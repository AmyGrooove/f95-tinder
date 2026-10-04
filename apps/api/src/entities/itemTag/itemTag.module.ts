import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemTag, ItemTagSchema } from "./schemas/itemTag.schema"
import { ItemTagRepository } from "./services/itemTag.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ItemTag.name, schema: ItemTagSchema }]),
  ],
  providers: [ItemTagRepository],
  exports: [ItemTagRepository],
})
class ItemTagModule {}

export { ItemTagModule }
