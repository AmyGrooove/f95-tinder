import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemBan, ItemBanSchema } from "./schemas/itemBan.schema"
import { ItemBanRepository } from "./services/itemBan.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ItemBan.name, schema: ItemBanSchema }]),
  ],
  providers: [ItemBanRepository],
  exports: [ItemBanRepository],
})
class ItemBanModule {}

export { ItemBanModule }
