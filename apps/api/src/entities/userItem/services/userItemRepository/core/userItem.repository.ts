import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, PipelineStage, Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import { ESort } from "@entities/shared/types/ESort"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { escapeRegex } from "@shared/functions/regex/escapeRegex"

import { EUserItemStatus } from "../../../schemas/EUserItemStatus"
import { UserItem } from "../../../schemas/userItem.schema"
import type { TCreateUserItem } from "../../../schemas/userItem.schema"
import { LIBRARY_CONTINUE_STATUSES } from "../../../static/LIBRARY_CONTINUE_STATUSES"
import { USER_ITEM_LIBRARY_STATUSES } from "../../../static/USER_ITEM_LIBRARY_STATUSES"
import type { TLibraryStatus } from "../../../types/TLibraryStatus"
import { createLibraryContinueItemLookup } from "../functions/aggregationPipelines/createLibraryContinueItemLookup"
import { createLibraryEntryProjection } from "../functions/aggregationPipelines/createLibraryEntryProjection"
import { createLibraryItemStatsLookup } from "../functions/aggregationPipelines/createLibraryItemStatsLookup"
import { createLibraryPageItemLookup } from "../functions/aggregationPipelines/createLibraryPageItemLookup"
import { createLibraryTitleSortStage } from "../functions/aggregationPipelines/createLibraryTitleSortStage"
import type {
  ILibraryEntry,
  IReadLibraryPageProps,
} from "../types/ILibraryPage"

@Injectable()
class UserItemRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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

  async readLibraryContinueStatus(
    userId: Types.ObjectId,
    types?: readonly EItemType[],
  ) {
    const pipeline = new AggregationBuilder()
      .match({ user: userId, status: { $in: LIBRARY_CONTINUE_STATUSES } })
      .project({ _id: 0, item: 1, status: 1 })
      .use(createLibraryContinueItemLookup(types))
      .match({ "visibleItem.0": { $exists: true } })
      .project({
        status: 1,
        priority: { $indexOfArray: [LIBRARY_CONTINUE_STATUSES, "$status"] },
      })
      .sort({ priority: 1 })
      .limit(1)
      .project({ status: 1 })
      .build()

    const [record] = await this.aggregation.aggregate<{
      status: (typeof LIBRARY_CONTINUE_STATUSES)[number]
    }>(pipeline)

    return record?.status ?? null
  }

  async readLibrarySummary(userId: Types.ObjectId) {
    const pipeline = new AggregationBuilder()
      .match({ user: userId, status: { $in: USER_ITEM_LIBRARY_STATUSES } })
      .project({ _id: 0, item: 1, status: 1, rating: 1, isFavorite: 1 })
      .use(createLibraryPageItemLookup({}, { _id: 1 }))
      .match({ "visibleItem.0": { $exists: true } })
      .use({
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          ratingsCount: {
            $sum: {
              $cond: [{ $ne: [{ $ifNull: ["$rating", null] }, null] }, 1, 0],
            },
          },
          favoritesCount: {
            $sum: { $cond: [{ $eq: ["$isFavorite", true] }, 1, 0] },
          },
        },
      })
      .build()

    const groups = await this.aggregation.aggregate<{
      _id: TLibraryStatus
      count: number
      ratingsCount: number
      favoritesCount: number
    }>(pipeline)
    const summary = {
      statusCounts: {
        planned: 0,
        inProgress: 0,
        onHold: 0,
        completed: 0,
        dropped: 0,
      } satisfies Record<TLibraryStatus, number>,
      ratingsCount: 0,
      favoritesCount: 0,
    }

    for (const group of groups) {
      summary.statusCounts[group._id] = group.count
      summary.ratingsCount += group.ratingsCount
      summary.favoritesCount += group.favoritesCount
    }

    return summary
  }

  readLibraryPage(props: IReadLibraryPageProps) {
    const {
      userId,
      statuses,
      types,
      isFavorite,
      isUnrated = false,
      after,
      search,
      sort,
      direction,
      language,
      offset,
      limit,
      isProgressVisible,
    } = props
    const isTitleSort = sort === ESort.TITLE
    const itemFilter: PipelineStage.Match["$match"] = {
      type: { $in: types },
    }

    if (!isUndefined(search)) {
      const text = { $regex: escapeRegex(search), $options: "i" }

      itemFilter.$or = [
        { "title.ru": text },
        { "title.en": text },
        { aliases: text },
      ]
    }

    const pipeline = new AggregationBuilder()
      .match({
        user: userId,
        status: { $in: statuses },
        ...(!isUndefined(isFavorite) && { isFavorite }),
        ...(isUnrated && { rating: null }),
        ...(!isUndefined(after) && {
          $or: [
            { createdAt: { $lt: after.createdAt } },
            { createdAt: after.createdAt, _id: { $gt: after.id } },
          ],
        }),
      })
      .project({
        item: 1,
        status: 1,
        isFavorite: 1,
        rating: 1,
        createdAt: 1,
        updatedAt: 1,
        ...(isProgressVisible && {
          latestAttempt: { $arrayElemAt: ["$attempts", -1] },
        }),
      })
      .use(createLibraryPageItemLookup(itemFilter), { $unwind: "$visibleItem" })

    if (isTitleSort) {
      pipeline
        .use(createLibraryTitleSortStage(language))
        .sort({ sortTitle: direction, _id: 1 })
    } else if (sort === ESort.RATING) {
      pipeline
        .use({
          $set: { hasRating: { $ne: [{ $ifNull: ["$rating", null] }, null] } },
        })
        .sort({ hasRating: -1, rating: direction, _id: 1 })
    } else {
      pipeline.sort({ [sort]: direction, _id: 1 })
    }

    if (offset > 0) {
      pipeline.use({ $skip: offset })
    }

    pipeline
      .limit(limit + 1)
      .use(createLibraryItemStatsLookup())
      .project(createLibraryEntryProjection(isProgressVisible))

    return this.aggregation.aggregate<ILibraryEntry>(
      pipeline.build(),
      isTitleSort
        ? { collation: { locale: language, strength: 2 } }
        : undefined,
    )
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
