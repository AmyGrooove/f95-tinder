import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"

import { EUserItemStatus } from "../../../schemas/EUserItemStatus"
import { UserItem } from "../../../schemas/userItem.schema"
import type { TCreateUserItem } from "../../../schemas/userItem.schema"

@Injectable()
class UserItemRepository {
  readonly read: MongoReadRepository<UserItem, HydratedDocument<UserItem>>
  readonly write: MongoWriteRepository<
    UserItem,
    HydratedDocument<UserItem>,
    TCreateUserItem
  >
  readonly pagination: MongoPaginationRepository<
    UserItem,
    HydratedDocument<UserItem>
  >
  readonly bulk: MongoBulkRepository<
    UserItem,
    HydratedDocument<UserItem>,
    TCreateUserItem
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<UserItem>>

  constructor(
    @InjectModel(UserItem.name) model: Model<HydratedDocument<UserItem>>,
  ) {
    this.read = new MongoReadRepository<UserItem, HydratedDocument<UserItem>>(
      model,
    )
    this.write = new MongoWriteRepository<
      UserItem,
      HydratedDocument<UserItem>,
      TCreateUserItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserItem,
      HydratedDocument<UserItem>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserItem,
      HydratedDocument<UserItem>,
      TCreateUserItem
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserItem>
    >(model)
  }

  async readPositiveRecommendationItemIds(userId: Types.ObjectId) {
    const records = await this.read.findMany(
      {
        user: userId,
        status: { $ne: EUserItemStatus.SKIPPED },
        $or: [
          { rating: { $gte: 8, $lte: 10 } },
          { isFavorite: true, rating: null },
          { isFavorite: true, rating: { $gte: 5, $lte: 10 } },
        ],
      },
      { _id: 0, item: 1 },
      { lean: true },
    )

    return records.map(({ item }) => item)
  }

  async readPlannedItemIds(userId: Types.ObjectId) {
    const records = await this.read.findMany(
      { user: userId, status: EUserItemStatus.PLANNED },
      { _id: 0, item: 1 },
      { lean: true },
    )

    return records.map(({ item }) => item)
  }
}

export { UserItemRepository }
