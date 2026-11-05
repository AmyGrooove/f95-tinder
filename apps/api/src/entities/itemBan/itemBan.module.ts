import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemBan, ItemBanSchema } from "./schemas/itemBan.schema"
import { ItemBanRepository } from "@entities/itemBan/services/itemBanRepository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ItemBan.name, schema: ItemBanSchema }]),
  ],
  providers: [ItemBanRepository],
  exports: [ItemBanRepository],
})
class ItemBanModule {}

export { ItemBanModule }
