import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserItem } from "../schemas/userItem.schema"
import type { TCreateUserItem } from "../schemas/userItem.schema"
import type { IItemRatingSummary } from "../types/IItemRatingSummary"

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

  async getRatingAverage() {
    const [result] = await this.aggregation.aggregate<{ average: number }>([
      { $match: { rating: { $ne: null } } },
      { $group: { _id: null, average: { $avg: "$rating" } } },
    ])

    return result?.average ?? null
  }

  async getRatingSummaries(itemIds: Types.ObjectId[]) {
    return await this.aggregation.aggregate<IItemRatingSummary>([
      { $match: { item: { $in: itemIds }, rating: { $ne: null } } },
      {
        $group: {
          _id: "$item",
          ratingAverage: { $avg: "$rating" },
          ratingsCount: { $sum: 1 },
        },
      },
    ])
  }
}

export { UserItemRepository }
