import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import { JobService } from "@infrastructure/jobs/services/job.service"

import { RECALCULATE_ITEM_RATINGS_JOB } from "../static/RECALCULATE_ITEM_RATINGS_JOB"

@Injectable()
class ItemRatingsRecalculationService {
  constructor(private readonly jobService: JobService) {}

  async enqueue(itemId: Types.ObjectId) {
    return await this.jobService.add(
      RECALCULATE_ITEM_RATINGS_JOB,
      itemId.toHexString(),
      {
        deduplication: {
          id: `${RECALCULATE_ITEM_RATINGS_JOB.name}:${itemId}`,
          keepLastIfActive: true,
        },
      },
    )
  }
}

export { ItemRatingsRecalculationService }
