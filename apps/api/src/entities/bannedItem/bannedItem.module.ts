import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { BannedItem, BannedItemSchema } from "./schemas/bannedItem.schema"
import { BannedItemRepository } from "./services/bannedItem.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BannedItem.name, schema: BannedItemSchema },
    ]),
  ],
  providers: [BannedItemRepository],
  exports: [BannedItemRepository],
})
class BannedItemModule {}

export { BannedItemModule }
