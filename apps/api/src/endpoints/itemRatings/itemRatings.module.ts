import { Module } from "@nestjs/common"

import { ItemModule } from "@entities/item/item.module"
import { ItemMetricModule } from "@entities/itemMetric/itemMetric.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"

import { RecalculateItemRatingsJobHandler } from "./handlers/recalculateItemRatingsJob.handler"
import { ItemRatingsRecalculationService } from "./services/itemRatingsRecalculation.service"

@Module({
  imports: [ItemModule, ItemMetricModule, UserItemModule, JobsModule],
  providers: [
    RecalculateItemRatingsJobHandler,
    ItemRatingsRecalculationService,
  ],
  exports: [ItemRatingsRecalculationService],
})
class ItemRatingsModule {}

export { ItemRatingsModule }
