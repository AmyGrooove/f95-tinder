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
import { ItemTag } from "@entities/itemTag/schemas/itemTag.schema"
import { EUserItemStatus } from "../schemas/EUserItemStatus"
import { USER_ITEM_LIBRARY_STATUSES } from "../static/USER_ITEM_LIBRARY_STATUSES"

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

  async getTasteInputs(
    userId: Types.ObjectId,
    tagIds: readonly Types.ObjectId[],
  ) {
    return await this.aggregation.aggregate<
      Pick<UserItem, "item" | "rating" | "isFavorite" | "attempts">
    >([
      {
        $match: {
          user: userId,
          status: { $ne: EUserItemStatus.SKIPPED },
          $or: [
            { rating: { $ne: null } },
            { isFavorite: true },
            { "attempts.isCompleted": true },
          ],
        },
      },
      {
        $lookup: {
          from: ItemTag.name,
          localField: "item",
          foreignField: "item",
          pipeline: [
            { $match: { tag: { $in: tagIds }, relevanceScore: { $gt: 0 } } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: "matchedTag",
        },
      },
      { $match: { "matchedTag.0": { $exists: true } } },
      { $project: { _id: 0, item: 1, rating: 1, isFavorite: 1, attempts: 1 } },
    ])
  }

  async getRatingAverage() {
    const [result] = await this.aggregation.aggregate<{ average: number }>([
      { $match: { rating: { $ne: null } } },
      { $group: { _id: null, average: { $avg: "$rating" } } },
    ])

    return result?.average ?? null
  }

  async getRatingSummaries(itemIds: Types.ObjectId[]) {
    const ratingCounts = Object.fromEntries(
      Object.entries({
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      }).map(([key, rating]) => [
        key,
        { $sum: { $cond: [{ $eq: ["$rating", rating] }, 1, 0] } },
      ]),
    )
    const statusCounts = Object.fromEntries(
      USER_ITEM_LIBRARY_STATUSES.map((status) => [
        status,
        { $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } },
      ]),
    )

    return await this.aggregation.aggregate<IItemRatingSummary>([
      { $match: { item: { $in: itemIds } } },
      {
        $group: {
          _id: "$item",
          ratingAverage: { $avg: "$rating" },
          ratingsCount: {
            $sum: {
              $cond: [{ $ne: [{ $ifNull: ["$rating", null] }, null] }, 1, 0],
            },
          },
          completedAttemptsCount: {
            $sum: {
              $size: {
                $filter: {
                  input: "$attempts",
                  as: "attempt",
                  cond: { $eq: ["$$attempt.isCompleted", true] },
                },
              },
            },
          },
          favoritesCount: {
            $sum: { $cond: [{ $eq: ["$isFavorite", true] }, 1, 0] },
          },
          ...ratingCounts,
          ...statusCounts,
        },
      },
      {
        $project: {
          _id: 1,
          ratingAverage: 1,
          ratingsCount: 1,
          completedAttemptsCount: 1,
          favoritesCount: 1,
          ratingDistribution: Object.fromEntries(
            Object.keys(ratingCounts).map((key) => [key, `$${key}`]),
          ),
          statusCounts: Object.fromEntries(
            USER_ITEM_LIBRARY_STATUSES.map((status) => [status, `$${status}`]),
          ),
        },
      },
    ])
  }
}

export { UserItemRepository }
