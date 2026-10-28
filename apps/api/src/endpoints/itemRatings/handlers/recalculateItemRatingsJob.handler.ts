import { Injectable } from "@nestjs/common"
import { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/item.repository"
import { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"

import { RECALCULATE_ITEM_RATINGS_JOB } from "../static/RECALCULATE_ITEM_RATINGS_JOB"

@Injectable()
@JobHandler(RECALCULATE_ITEM_RATINGS_JOB)
class RecalculateItemRatingsJobHandler implements IJobHandler<string> {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly itemMetricRepository: ItemMetricRepository,
    private readonly userItemRepository: UserItemRepository,
  ) {}

  async handle(payload: string, context: IJobContext) {
    const itemId = new Types.ObjectId(payload)

    await context.throwIfCancelled()

    if (!(await this.itemRepository.read.checkIsExists({ _id: itemId }))) {
      return { processedItems: 0 }
    }

    const [summary] = await this.userItemRepository.getRatingSummaries([itemId])

    await context.throwIfCancelled()
    await this.itemMetricRepository.write.updateByFilter(
      { item: itemId },
      {
        $set: {
          ratingAverage: summary?.ratingAverage ?? null,
          ratingsCount: summary?.ratingsCount ?? 0,
          completedAttemptsCount: summary?.completedAttemptsCount ?? 0,
          favoritesCount: summary?.favoritesCount ?? 0,
          ratingDistribution: summary?.ratingDistribution ?? {
            one: 0,
            two: 0,
            three: 0,
            four: 0,
            five: 0,
            six: 0,
            seven: 0,
            eight: 0,
            nine: 0,
            ten: 0,
          },
          statusCounts: summary?.statusCounts ?? {
            planned: 0,
            inProgress: 0,
            onHold: 0,
            completed: 0,
            dropped: 0,
          },
        },
      },
      { upsert: true },
    )

    return { processedItems: 1 }
  }
}

export { RecalculateItemRatingsJobHandler }
