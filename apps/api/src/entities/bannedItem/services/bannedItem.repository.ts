import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { BannedItem } from "../schemas/bannedItem.schema"
import type { TCreateBannedItem } from "../schemas/bannedItem.schema"

@Injectable()
class BannedItemRepository {
  readonly read: MongoReadRepository<BannedItem, HydratedDocument<BannedItem>>
  readonly write: MongoWriteRepository<
    BannedItem,
    HydratedDocument<BannedItem>,
    TCreateBannedItem
  >
  readonly pagination: MongoPaginationRepository<
    BannedItem,
    HydratedDocument<BannedItem>
  >
  readonly bulk: MongoBulkRepository<
    BannedItem,
    HydratedDocument<BannedItem>,
    TCreateBannedItem
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<BannedItem>>

  constructor(
    @InjectModel(BannedItem.name) model: Model<HydratedDocument<BannedItem>>,
  ) {
    this.read = new MongoReadRepository<
      BannedItem,
      HydratedDocument<BannedItem>
    >(model)
    this.write = new MongoWriteRepository<
      BannedItem,
      HydratedDocument<BannedItem>,
      TCreateBannedItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      BannedItem,
      HydratedDocument<BannedItem>
    >(model)
    this.bulk = new MongoBulkRepository<
      BannedItem,
      HydratedDocument<BannedItem>,
      TCreateBannedItem
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<BannedItem>
    >(model)
  }
}

export { BannedItemRepository }
