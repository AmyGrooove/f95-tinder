import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, QueryOptions, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

import { Item } from "../../../schemas/item.schema"
import type { TCreateItem } from "../../../schemas/item.schema"
import type { IItemDetails } from "../types/IItemDetails"
import { ItemBan } from "@entities/itemBan/schemas/itemBan.schema"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { ITEM_RATING_SCORE_SETTINGS } from "@entities/itemStats/static/ITEM_RATING_SCORE_SETTINGS"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import type { IItemSearchIndexEntry } from "../types/IItemSearchIndexEntry"
import type { IItemPosterCard } from "../types/IItemPosterCard"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { createItemTagFilterPipeline } from "../functions/createItemTagFilterPipeline"
import type {
  IItemReleaseWindow,
  IReadNewItemIdsProps,
  IReadPopularItemIdsProps,
} from "../types/IReadPopularItemIdsProps"
import type { IReadSearchIndexBatchProps } from "../types/IReadSearchIndexBatchProps"

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

  readSearchIndexBatch(props: IReadSearchIndexBatchProps) {
    const { limit, afterId } = props

    const pipeline = new AggregationBuilder()
      .match(!isUndefined(afterId) ? { _id: { $gt: afterId } } : {})
      .sort({ _id: 1 })
      .limit(limit)
      .use(
        {
          $lookup: {
            from: TagItem.name,
            localField: "_id",
            foreignField: "item",
            pipeline: [
              {
                $lookup: {
                  from: Tag.name,
                  localField: "tag",
                  foreignField: "_id",
                  pipeline: [{ $project: { _id: 1 } }],
                  as: "existingTag",
                },
              },
              { $match: { "existingTag.0": { $exists: true } } },
              { $project: { tag: 1 } },
            ],
            as: "searchTags",
          },
        },
        {
          $lookup: {
            from: ItemStats.name,
            localField: "_id",
            foreignField: "item",
            pipeline: [{ $project: { ratingAverage: 1, ratingsCount: 1 } }],
            as: "searchMetrics",
          },
        },
      )
      .project({
        _id: 1,
        type: 1,
        title: 1,
        aliases: 1,
        description: 1,
        media: 1,
        releaseDate: 1,
        ageRestriction: 1,
        movie: 1,
        series: 1,
        game: 1,
        deletedAt: 1,
        tagIds: "$searchTags.tag",
        ratingsCount: {
          $ifNull: [{ $arrayElemAt: ["$searchMetrics.ratingsCount", 0] }, 0],
        },
        rating: {
          $ifNull: [
            { $arrayElemAt: ["$searchMetrics.ratingAverage", 0] },
            null,
          ],
        },
      })
      .build()

    return this.aggregation.aggregate<IItemSearchIndexEntry>(pipeline)
  }

  readPopularItemIds(props: IReadPopularItemIdsProps) {
    return this.readRecommendationItemIds(props)
  }

  readNewItemIds(props: IReadNewItemIdsProps) {
    return this.readRecommendationItemIds(props, props.releaseWindow)
  }

  private async readRecommendationItemIds(
    props: IReadPopularItemIdsProps,
    releaseWindow?: IItemReleaseWindow,
  ) {
    const {
      type,
      limit,
      siteRatingAverage,
      userId,
      country,
      library = { anyOf: ["outside"] },
      tags = [],
      rating,
    } = props
    const { min, max } = rating ?? {}

    if (
      (!isUndefined(min) && (!isFiniteNumber(min) || min < 1 || min > 10)) ||
      (!isUndefined(max) && (!isFiniteNumber(max) || max < 1 || max > 10)) ||
      (!isUndefined(min) && !isUndefined(max) && min > max)
    ) {
      throw new RangeError("Invalid item rating range")
    }

    const { allOf = [], anyOf, noneOf = [] } = library
    const allowedStatuses = (
      [...USER_ITEM_LIBRARY_STATUSES, "outside"] as const
    ).filter(
      (status) =>
        allOf.every((value) => value === status) &&
        (anyOf?.includes(status) ?? true) &&
        !noneOf.includes(status),
    )

    if (allowedStatuses.length === 0) {
      return []
    }

    const { priorWeight, defaultSiteRatingAverage } = ITEM_RATING_SCORE_SETTINGS
    const baseline = siteRatingAverage ?? defaultSiteRatingAverage
    const isNew = !isUndefined(releaseWindow)
    const isUnratedAllowed = isNew && isUndefined(min) && isUndefined(max)
    const pipeline = new AggregationBuilder()
      .match({
        type,
        deletedAt: null,
        ...(isNew
          ? {
              releaseDate: {
                $gte: releaseWindow.from,
                $lte: releaseWindow.through,
              },
            }
          : {}),
      })
      .use({
        $lookup: {
          from: ItemStats.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                ratingsCount: { $gt: 0 },
                ratingAverage: {
                  $type: "number",
                  ...(!isUndefined(min) ? { $gte: min } : {}),
                  ...(!isUndefined(max) ? { $lte: max } : {}),
                },
              },
            },
            { $project: { _id: 0, ratingsCount: 1, ratingAverage: 1 } },
          ],
          as: "metrics",
        },
      })
      .use({
        $unwind: {
          path: "$metrics",
          preserveNullAndEmptyArrays: isUnratedAllowed,
        },
      })
      .use({
        $lookup: {
          from: UserItem.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                user: userId,
                $or: [
                  { status: { $ne: EUserItemStatus.SKIPPED } },
                  { expiresAt: { $gt: new Date() } },
                ],
              },
            },
            { $project: { _id: 0, status: 1 } },
          ],
          as: "libraryEntry",
        },
      })
      .match({
        $expr: {
          $in: [
            {
              $ifNull: [
                { $arrayElemAt: ["$libraryEntry.status", 0] },
                "outside",
              ],
            },
            allowedStatuses,
          ],
        },
      })
      .use({
        $lookup: {
          from: ItemBan.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $match: {
                $or: [{ countries: { $size: 0 } }, { countries: country }],
              },
            },
            { $project: { _id: 1 } },
          ],
          as: "activeBans",
        },
      })
      .match({ "activeBans.0": { $exists: false } })
      .use(...createItemTagFilterPipeline(tags))
      .project({
        releaseDate: 1,
        ratingsCount: "$metrics.ratingsCount",
        ratingScore: {
          $divide: [
            {
              $add: [
                {
                  $multiply: [
                    "$metrics.ratingsCount",
                    "$metrics.ratingAverage",
                  ],
                },
                priorWeight * baseline,
              ],
            },
            { $add: ["$metrics.ratingsCount", priorWeight] },
          ],
        },
      })
      .sort(
        isNew
          ? { releaseDate: -1, ratingScore: -1, _id: 1 }
          : { ratingScore: -1, ratingsCount: -1, _id: 1 },
      )
      .limit(limit)
      .project({ _id: 1 })
      .build()

    const items = await this.aggregation.aggregate<Pick<Item, "_id">>(pipeline)

    return items.map((item) => item._id)
  }

  async readPosterCardsByIds(ids: readonly Types.ObjectId[]) {
    if (ids.length === 0) {
      return []
    }

    const pipeline = new AggregationBuilder()
      .match({ _id: { $in: ids }, deletedAt: null })
      .project({
        _id: 1,
        type: 1,
        title: 1,
        media: {
          $filter: {
            input: { $ifNull: ["$media", []] },
            as: "media",
            cond: { $eq: ["$$media.type", EMediaType.POSTER] },
          },
        },
      })
      .build()
    const cards = await this.aggregation.aggregate<IItemPosterCard>(pipeline)
    const cardsById = new Map(
      cards.map((card) => [card._id.toHexString(), card]),
    )

    return ids.flatMap((id) => {
      const card = cardsById.get(id.toHexString())

      return isUndefined(card) ? [] : [card]
    })
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

  async findDetailsById(id: Types.ObjectId): Promise<IItemDetails | null> {
    const pipeline = new AggregationBuilder()
      .match({ _id: id, deletedAt: null })
      .project({
        _id: 1,
        type: 1,
        title: 1,
        description: 1,
        aliases: 1,
        media: 1,
        releaseDate: 1,
        ageRestriction: 1,
        movie: 1,
        series: 1,
        game: 1,
      })
      .use({
        $lookup: {
          from: "TagItem",
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $lookup: {
                from: "Tag",
                localField: "tag",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, key: 1, group: 1, name: 1 } }],
                as: "tag",
              },
            },
            { $unwind: "$tag" },
            { $sort: { relevanceScore: -1, "tag._id": 1 } },
            { $replaceWith: "$tag" },
          ],
          as: "tags",
        },
      })
      .use({
        $lookup: {
          from: "ItemRelation",
          pipeline: [
            {
              $match: {
                $or: [{ "first.item": id }, { "second.item": id }],
              },
            },
            {
              $project: {
                side: {
                  $cond: [{ $eq: ["$first.item", id] }, "$second", "$first"],
                },
              },
            },
            {
              $lookup: {
                from: "Item",
                localField: "side.item",
                foreignField: "_id",
                pipeline: [
                  { $match: { deletedAt: null } },
                  { $project: { _id: 1, type: 1, title: 1, media: 1 } },
                ],
                as: "item",
              },
            },
            { $unwind: "$item" },
            {
              $lookup: {
                from: "Relation",
                localField: "side.role",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, key: 1, name: 1 } }],
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                item: 1,
                role: 1,
                roleNameOverride: "$side.roleNameOverride",
              },
            },
          ],
          as: "relations",
        },
      })
      .build()

    const [item] = await this.aggregation.aggregate<IItemDetails>(pipeline)

    return item ?? null
  }
}

export { ItemRepository }
