import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemStats, ItemStatsSchema } from "./schemas/itemStats.schema"
import { ItemStatsRepository } from "@entities/itemStats/services/itemStatsRepository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemStats.name, schema: ItemStatsSchema },
    ]),
  ],
  providers: [ItemStatsRepository],
  exports: [ItemStatsRepository],
})
class ItemStatsModule {}

export { ItemStatsModule }
