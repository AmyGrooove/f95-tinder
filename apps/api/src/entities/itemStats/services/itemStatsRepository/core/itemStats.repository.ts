import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import { ItemStats } from "../../../schemas/itemStats.schema"
import type { TCreateItemStats } from "../../../schemas/itemStats.schema"
import { createItemStatsUpdatePipeline } from "../functions/aggregationPipelines/createItemStatsUpdatePipeline"
import type { IUpdateItemStatsProps } from "../types/IUpdateItemStatsProps"

@Injectable()
class ItemStatsRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

  constructor(
    @InjectModel(ItemStats.name)
    private readonly model: Model<HydratedDocument<ItemStats>>,
  ) {
    this.read = new MongoReadRepository<ItemStats, HydratedDocument<ItemStats>>(
      model,
    )
    this.write = new MongoWriteRepository<
      ItemStats,
      HydratedDocument<ItemStats>,
      TCreateItemStats
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemStats,
      HydratedDocument<ItemStats>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemStats,
      HydratedDocument<ItemStats>,
      TCreateItemStats
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemStats>
    >(model)
  }

  async applyChanges(props: IUpdateItemStatsProps) {
    const { itemId, session } = props

    const metric = await this.model
      .findOneAndUpdate(
        { item: itemId },
        createItemStatsUpdatePipeline(props),
        {
          session,
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

export { ItemStatsRepository }
