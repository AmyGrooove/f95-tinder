import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemMetric } from "../schemas/itemMetric.schema"
import type { TCreateItemMetric } from "../schemas/itemMetric.schema"

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
    @InjectModel(ItemMetric.name) model: Model<HydratedDocument<ItemMetric>>,
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
}

export { ItemMetricRepository }
