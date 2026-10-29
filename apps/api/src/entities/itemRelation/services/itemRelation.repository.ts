import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemRelation } from "../schemas/itemRelation.schema"
import type { TCreateItemRelation } from "../schemas/itemRelation.schema"

@Injectable()
class ItemRelationRepository {
  readonly read: MongoReadRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>
  >
  readonly write: MongoWriteRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>,
    TCreateItemRelation
  >
  readonly pagination: MongoPaginationRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>
  >
  readonly bulk: MongoBulkRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>,
    TCreateItemRelation
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<ItemRelation>
  >

  constructor(
    @InjectModel(ItemRelation.name)
    model: Model<HydratedDocument<ItemRelation>>,
  ) {
    this.read = new MongoReadRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>
    >(model)
    this.write = new MongoWriteRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>,
      TCreateItemRelation
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>,
      TCreateItemRelation
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemRelation>
    >(model)
  }
}

export { ItemRelationRepository }
