import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemFeature } from "../schemas/itemFeature.schema"
import type { TCreateItemFeature } from "../schemas/itemFeature.schema"

@Injectable()
class ItemFeatureRepository {
  readonly read: MongoReadRepository<ItemFeature, HydratedDocument<ItemFeature>>
  readonly write: MongoWriteRepository<
    ItemFeature,
    HydratedDocument<ItemFeature>,
    TCreateItemFeature
  >
  readonly pagination: MongoPaginationRepository<
    ItemFeature,
    HydratedDocument<ItemFeature>
  >
  readonly bulk: MongoBulkRepository<
    ItemFeature,
    HydratedDocument<ItemFeature>,
    TCreateItemFeature
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<ItemFeature>
  >

  constructor(
    @InjectModel(ItemFeature.name) model: Model<HydratedDocument<ItemFeature>>,
  ) {
    this.read = new MongoReadRepository<
      ItemFeature,
      HydratedDocument<ItemFeature>
    >(model)
    this.write = new MongoWriteRepository<
      ItemFeature,
      HydratedDocument<ItemFeature>,
      TCreateItemFeature
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemFeature,
      HydratedDocument<ItemFeature>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemFeature,
      HydratedDocument<ItemFeature>,
      TCreateItemFeature
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemFeature>
    >(model)
  }
}

export { ItemFeatureRepository }
