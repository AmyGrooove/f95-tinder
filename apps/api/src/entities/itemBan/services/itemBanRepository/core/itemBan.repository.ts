import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import { ItemBan } from "../../../schemas/itemBan.schema"
import type { TCreateItemBan } from "../../../schemas/itemBan.schema"

@Injectable()
class ItemBanRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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
