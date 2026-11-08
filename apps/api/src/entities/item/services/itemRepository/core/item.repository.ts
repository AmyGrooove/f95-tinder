import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  Model,
  PipelineStage,
  QueryOptions,
  Types,
} from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

import { Item } from "../../../schemas/item.schema"
import type { TCreateItem } from "../../../schemas/item.schema"
import type { IItemDetails } from "../types/IItemDetails"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { ITEM_RATING_SCORE_SETTINGS } from "@entities/itemStats/static/ITEM_RATING_SCORE_SETTINGS"
import { EMediaType } from "@entities/shared/schemas/EMediaType"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import type { IItemSearchIndexEntry } from "../types/IItemSearchIndexEntry"
import type { IItemPosterCard } from "../types/IItemPosterCard"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { createRecommendationEligibilityPipeline } from "../functions/createRecommendationEligibilityPipeline"
import type {
  IItemReleaseWindow,
  IReadNewItemIdsProps,
  IReadPopularItemIdsProps,
} from "../types/IReadPopularItemIdsProps"
import type { IReadRecommendationPosterCardsProps } from "../types/IRecommendationEligibilityProps"
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
    const { type, limit, siteRatingAverage } = props
    const isNew = !isUndefined(releaseWindow)
    const eligibility = createRecommendationEligibilityPipeline(
      props,
      isNew ? "optional" : "required",
    )

    if (eligibility === null) {
      return []
    }

    const { priorWeight, defaultSiteRatingAverage } = ITEM_RATING_SCORE_SETTINGS
    const baseline = siteRatingAverage ?? defaultSiteRatingAverage
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
      .use(...eligibility)
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

  readPosterCardsByIds(ids: readonly Types.ObjectId[]) {
    return this.readOrderedPosterCards(ids)
  }

  async readRecommendationPosterCards(
    props: IReadRecommendationPosterCardsProps,
  ) {
    const { ids, types } = props
    const eligibility = createRecommendationEligibilityPipeline(props)

    if (eligibility === null) {
      return []
    }

    return this.readOrderedPosterCards(ids, [
      ...(!isUndefined(types) ? [{ $match: { type: { $in: types } } }] : []),
      ...eligibility,
    ])
  }

  private async readOrderedPosterCards(
    ids: readonly Types.ObjectId[],
    eligibility: PipelineStage[] = [],
  ) {
    if (ids.length === 0) {
      return []
    }

    const pipeline = new AggregationBuilder()
      .match({ _id: { $in: ids }, deletedAt: null })
      .use(...eligibility)
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
