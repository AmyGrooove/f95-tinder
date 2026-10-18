import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Item, ItemSchema } from "./schemas/item.schema"
import { ItemRepository } from "./services/item.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Item.name, schema: ItemSchema }]),
  ],
  providers: [ItemRepository],
  exports: [ItemRepository],
})
class ItemModule {}

export { ItemModule }
