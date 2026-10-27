import { Module } from "@nestjs/common"

import { ItemTagModule } from "@entities/itemTag/itemTag.module"
import { TagModule } from "@entities/tag/tag.module"
import { JobsModule } from "@infrastructure/jobs/jobs.module"
import { SchedulerModule } from "@infrastructure/scheduler/scheduler.module"

import { RecalculateTagWeightModifiersJobHandler } from "./handlers/recalculateTagWeightModifiersJob.handler"
import { TagWeightModifiersSchedulerService } from "./services/tagWeightModifiersScheduler.service"

@Module({
  imports: [TagModule, ItemTagModule, JobsModule, SchedulerModule],
  providers: [
    RecalculateTagWeightModifiersJobHandler,
    TagWeightModifiersSchedulerService,
  ],
})
class TagWeightModifiersModule {}

export { TagWeightModifiersModule }
