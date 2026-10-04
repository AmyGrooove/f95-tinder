import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemTag } from "../schemas/itemTag.schema"
import type { TCreateItemTag } from "../schemas/itemTag.schema"

@Injectable()
class ItemTagRepository {
  readonly read: MongoReadRepository<ItemTag, HydratedDocument<ItemTag>>
  readonly write: MongoWriteRepository<
    ItemTag,
    HydratedDocument<ItemTag>,
    TCreateItemTag
  >
  readonly pagination: MongoPaginationRepository<
    ItemTag,
    HydratedDocument<ItemTag>
  >
  readonly bulk: MongoBulkRepository<
    ItemTag,
    HydratedDocument<ItemTag>,
    TCreateItemTag
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<ItemTag>>

  constructor(
    @InjectModel(ItemTag.name) model: Model<HydratedDocument<ItemTag>>,
  ) {
    this.read = new MongoReadRepository<ItemTag, HydratedDocument<ItemTag>>(
      model,
    )
    this.write = new MongoWriteRepository<
      ItemTag,
      HydratedDocument<ItemTag>,
      TCreateItemTag
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemTag,
      HydratedDocument<ItemTag>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemTag,
      HydratedDocument<ItemTag>,
      TCreateItemTag
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemTag>
    >(model)
  }
}

export { ItemTagRepository }
