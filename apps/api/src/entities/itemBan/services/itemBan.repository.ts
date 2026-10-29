import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemBan } from "../schemas/itemBan.schema"
import type { TCreateItemBan } from "../schemas/itemBan.schema"

@Injectable()
class ItemBanRepository {
  readonly read: MongoReadRepository<ItemBan, HydratedDocument<ItemBan>>
  readonly write: MongoWriteRepository<
    ItemBan,
    HydratedDocument<ItemBan>,
    TCreateItemBan
  >
  readonly pagination: MongoPaginationRepository<
    ItemBan,
    HydratedDocument<ItemBan>
  >
  readonly bulk: MongoBulkRepository<
    ItemBan,
    HydratedDocument<ItemBan>,
    TCreateItemBan
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<ItemBan>>

  constructor(
    @InjectModel(ItemBan.name) model: Model<HydratedDocument<ItemBan>>,
  ) {
    this.read = new MongoReadRepository<ItemBan, HydratedDocument<ItemBan>>(
      model,
    )
    this.write = new MongoWriteRepository<
      ItemBan,
      HydratedDocument<ItemBan>,
      TCreateItemBan
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemBan,
      HydratedDocument<ItemBan>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemBan,
      HydratedDocument<ItemBan>,
      TCreateItemBan
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemBan>
    >(model)
  }
}

export { ItemBanRepository }
