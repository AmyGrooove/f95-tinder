import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, QueryOptions, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Item } from "../schemas/item.schema"
import type { TCreateItem } from "../schemas/item.schema"

@Injectable()
class ItemRepository {
  readonly read: MongoReadRepository<Item, HydratedDocument<Item>>
  readonly write: MongoWriteRepository<
    Item,
    HydratedDocument<Item>,
    TCreateItem
  >
  readonly pagination: MongoPaginationRepository<Item, HydratedDocument<Item>>
  readonly bulk: MongoBulkRepository<Item, HydratedDocument<Item>, TCreateItem>
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Item>>

  constructor(@InjectModel(Item.name) model: Model<HydratedDocument<Item>>) {
    this.read = new MongoReadRepository<Item, HydratedDocument<Item>>(model)
    this.write = new MongoWriteRepository<
      Item,
      HydratedDocument<Item>,
      TCreateItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      Item,
      HydratedDocument<Item>
    >(model)
    this.bulk = new MongoBulkRepository<
      Item,
      HydratedDocument<Item>,
      TCreateItem
    >(model)
    this.aggregation = new MongoAggregationRepository<HydratedDocument<Item>>(
      model,
    )
  }

  findNotDeletedByIds(
    ids: Types.ObjectId[],
    options?: Pick<QueryOptions<Item>, "session">,
  ) {
    return this.read.findMany(
      { _id: { $in: ids }, deletedAt: null },
      { _id: 1 },
      options,
    )
  }
}

export { ItemRepository }
