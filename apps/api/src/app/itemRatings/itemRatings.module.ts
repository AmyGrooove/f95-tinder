import { Module } from "@nestjs/common"

import { ItemModule } from "@entities/item/item.module"
import { ItemMetricModule } from "@entities/itemMetric/itemMetric.module"
import { UserItemModule } from "@entities/userItem/userItem.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"

import { RecalculateItemRatingsJobHandler } from "./handlers/recalculateItemRatingsJob.handler"
import { ItemRatingsSchedulerService } from "./services/itemRatingsScheduler.service"

@Module({
  imports: [
    ItemModule,
    ItemMetricModule,
    UserItemModule,
    JobsModule,
    SchedulerModule,
  ],
  providers: [RecalculateItemRatingsJobHandler, ItemRatingsSchedulerService],
})
class ItemRatingsModule {}

export { ItemRatingsModule }
