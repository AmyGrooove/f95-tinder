import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"

import { ItemMetric } from "../schemas/itemMetric.schema"
import type { TCreateItemMetric } from "../schemas/itemMetric.schema"
import { RATING_DISTRIBUTION_VALUES } from "../static/RATING_DISTRIBUTION_VALUES"
import type { IUpdateItemMetricProps } from "../types/IUpdateItemMetricProps"

@Injectable()
class ItemMetricRepository {
  readonly read: MongoReadRepository<ItemMetric, HydratedDocument<ItemMetric>>
  readonly write: MongoWriteRepository<
    ItemMetric,
    HydratedDocument<ItemMetric>,
    TCreateItemMetric
  >
  readonly pagination: MongoPaginationRepository<
    ItemMetric,
    HydratedDocument<ItemMetric>
  >
  readonly bulk: MongoBulkRepository<
    ItemMetric,
    HydratedDocument<ItemMetric>,
    TCreateItemMetric
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<ItemMetric>>

  constructor(
    @InjectModel(ItemMetric.name)
    private readonly model: Model<HydratedDocument<ItemMetric>>,
  ) {
    this.read = new MongoReadRepository<
      ItemMetric,
      HydratedDocument<ItemMetric>
    >(model)
    this.write = new MongoWriteRepository<
      ItemMetric,
      HydratedDocument<ItemMetric>,
      TCreateItemMetric
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemMetric,
      HydratedDocument<ItemMetric>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemMetric,
      HydratedDocument<ItemMetric>,
      TCreateItemMetric
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemMetric>
    >(model)
  }

  async applyChanges(props: IUpdateItemMetricProps) {
    const increments = {
      ratingsCount: props.ratingsCount,
      favoritesCount: props.favoritesCount,
      completedAttemptsCount: props.completedAttemptsCount,
      ...Object.fromEntries(
        Object.keys(RATING_DISTRIBUTION_VALUES).map((key) => [
          `ratingDistribution.${key}`,
          0,
        ]),
      ),
      ...Object.fromEntries(
        USER_ITEM_LIBRARY_STATUSES.map((status) => [
          `statusCounts.${status}`,
          0,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(props.ratingDistribution).map(([key, value]) => [
          `ratingDistribution.${key}`,
          value,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(props.statusCounts).map(([key, value]) => [
          `statusCounts.${key}`,
          value,
        ]),
      ),
    }
    const metric = await this.model
      .findOneAndUpdate(
        { item: props.itemId },
        [
          {
            $set: Object.fromEntries(
              Object.entries(increments).map(([key, value]) => [
                key,
                { $add: [{ $ifNull: [`$${key}`, 0] }, value] },
              ]),
            ),
          },
          {
            $set: {
              createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
              ratingAverage: {
                $cond: [
                  { $gt: ["$ratingsCount", 0] },
                  {
                    $divide: [
                      {
                        $add: Object.entries(RATING_DISTRIBUTION_VALUES).map(
                          ([key, value]) => ({
                            $multiply: [`$ratingDistribution.${key}`, value],
                          }),
                        ),
                      },
                      "$ratingsCount",
                    ],
                  },
                  null,
                ],
              },
            },
          },
        ],
        {
          session: props.session,
          upsert: true,
          returnDocument: "after",
          updatePipeline: true,
        },
      )
      .orFail()
      .exec()

    await metric.validate()

    return metric
  }
}

export { ItemMetricRepository }
