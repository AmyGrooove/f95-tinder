import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import { ItemRepository } from "@entities/item/services/item.repository"
import { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { RECALCULATE_ITEM_RATINGS_JOB } from "../static/RECALCULATE_ITEM_RATINGS_JOB"

@Injectable()
@JobHandler(RECALCULATE_ITEM_RATINGS_JOB)
class RecalculateItemRatingsJobHandler implements IJobHandler<null> {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly itemMetricRepository: ItemMetricRepository,
    private readonly userItemRepository: UserItemRepository,
  ) {}

  async handle(_payload: null, context: IJobContext) {
    let lastId: Types.ObjectId | undefined
    let processedItems = 0

    while (true) {
      await context.throwIfCancelled()

      const items = await this.itemRepository.read.findMany(
        !isUndefined(lastId) ? { _id: { $gt: lastId } } : {},
        { _id: 1 },
        { sort: { _id: 1 }, limit: 500 },
      )

      if (items.length === 0) {
        break
      }

      const summaries = await this.userItemRepository.getRatingSummaries(
        items.map((item) => item._id),
      )
      const summariesByItem = new Map(
        summaries.map((summary) => [String(summary._id), summary]),
      )
      const operations = items.map((item) => {
        const summary = summariesByItem.get(String(item._id))

        return {
          updateOne: {
            filter: { item: item._id },
            update: {
              $set: {
                ratingAverage: summary?.ratingAverage ?? null,
                ratingsCount: summary?.ratingsCount ?? 0,
              },
            },
            upsert: true,
          },
        }
      })

      await context.throwIfCancelled()
      await this.itemMetricRepository.bulk.bulkWrite(operations, {
        ordered: false,
      })

      processedItems += items.length
      lastId = items[items.length - 1]._id
    }

    return { processedItems }
  }
}

export { RecalculateItemRatingsJobHandler }
