import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { JobService } from "@infrastructure/jobs/services/job.service"

import { RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB } from "../static/RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB"

@Injectable()
class TagWeightModifiersSchedulerService {
  constructor(private readonly jobService: JobService) {}

  @Cron("0 0 3 * * *", {
    timeZone: "Europe/Moscow",
    waitForCompletion: true,
  })
  async enqueueRecalculation() {
    return await this.jobService.add(
      RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB,
      null,
      {
        deduplication: { id: RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB.name },
      },
    )
  }
}

export { TagWeightModifiersSchedulerService }
