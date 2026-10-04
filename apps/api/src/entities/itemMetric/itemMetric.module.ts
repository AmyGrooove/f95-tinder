import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { ItemMetric, ItemMetricSchema } from "./schemas/itemMetric.schema"
import { ItemMetricRepository } from "./services/itemMetric.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemMetric.name, schema: ItemMetricSchema },
    ]),
  ],
  providers: [ItemMetricRepository],
  exports: [ItemMetricRepository],
})
class ItemMetricModule {}

export { ItemMetricModule }
