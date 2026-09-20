import { Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"

import { SchedulerHealthService } from "./services/schedulerHealth.service"

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SchedulerHealthService],
  exports: [SchedulerHealthService],
})
class SchedulerModule {}

export { SchedulerModule }
