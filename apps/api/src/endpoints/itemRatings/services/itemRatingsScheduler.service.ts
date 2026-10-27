import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { JobService } from "@infrastructure/jobs/services/job.service"

import { RECALCULATE_ITEM_RATINGS_JOB } from "../static/RECALCULATE_ITEM_RATINGS_JOB"

@Injectable()
class ItemRatingsSchedulerService {
  constructor(private readonly jobService: JobService) {}

  @Cron("0 0 */5 * * *", {
    timeZone: "Europe/Moscow",
    waitForCompletion: true,
  })
  async enqueueRecalculation() {
    return await this.jobService.add(RECALCULATE_ITEM_RATINGS_JOB, null, {
      deduplication: { id: RECALCULATE_ITEM_RATINGS_JOB.name },
    })
  }
}

export { ItemRatingsSchedulerService }
