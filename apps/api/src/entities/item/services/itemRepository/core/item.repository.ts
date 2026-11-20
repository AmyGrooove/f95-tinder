import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  Model,
  PipelineStage,
  QueryOptions,
  Types,
} from "mongoose"

import { ITEM_RATING_SCORE_SETTINGS } from "@entities/itemStats/static/ITEM_RATING_SCORE_SETTINGS"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { EItemType } from "../../../schemas/EItemType"
import { Item } from "../../../schemas/item.schema"
import type { TCreateItem } from "../../../schemas/item.schema"
import { createPosterCardProjection } from "../functions/aggregationPipelines/createPosterCardProjection"
import { createRecommendationEligibilityPipeline } from "../functions/aggregationPipelines/createRecommendationEligibilityPipeline"
import { createRecommendationScoreProjection } from "../functions/aggregationPipelines/createRecommendationScoreProjection"
import { createSearchIndexMetricsLookup } from "../functions/aggregationPipelines/createSearchIndexMetricsLookup"
import { createSearchIndexProjection } from "../functions/aggregationPipelines/createSearchIndexProjection"
import { createSearchIndexTagsLookup } from "../functions/aggregationPipelines/createSearchIndexTagsLookup"
import type { IItemPosterCard } from "../types/IItemPosterCard"
import type { IItemSearchIndexEntry } from "../types/IItemSearchIndexEntry"
import type {
  IItemReleaseWindow,
  IReadNewItemIdsProps,
  IReadPopularItemIdsProps,
} from "../types/IReadPopularItemIdsProps"
import type { IReadSearchIndexBatchProps } from "../types/IReadSearchIndexBatchProps"
import type { IRecommendationCard } from "../types/IRecommendationCard"
import type { IReadEligibleRecommendationItemsProps } from "../types/IRecommendationEligibilityProps"

@Injectable()
class ItemRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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

  readPosterCardsByIds(ids: readonly Types.ObjectId[]) {
    return this.readOrderedPosterCards(ids)
  }

  readSearchIndexBatch(props: IReadSearchIndexBatchProps) {
    const { limit, afterId } = props

    const pipeline = new AggregationBuilder()
      .match(!isUndefined(afterId) ? { _id: { $gt: afterId } } : {})
      .sort({ _id: 1 })
      .limit(limit)
      .use(createSearchIndexTagsLookup(), createSearchIndexMetricsLookup())
      .project(createSearchIndexProjection())
      .build()

    return this.aggregation.aggregate<IItemSearchIndexEntry>(pipeline)
  }

  readPopularItemIds(props: IReadPopularItemIdsProps) {
    return this.readRecommendationItemIds(props)
  }

  readNewItemIds(props: IReadNewItemIdsProps) {
    return this.readRecommendationItemIds(props, props.releaseWindow)
  }

  async readEligibleRecommendationItems(
    props: IReadEligibleRecommendationItemsProps,
  ) {
    const { ids, types } = props
    const eligibility = createRecommendationEligibilityPipeline(props)

    if (ids.length === 0 || isNil(eligibility)) {
      return []
    }

    const pipeline = new AggregationBuilder()
      .match({
        _id: { $in: ids },
        deletedAt: null,
        ...(isUndefined(types) ? {} : { type: { $in: types } }),
      })
      .use(...eligibility)
      .project({ _id: 1, type: 1 })
      .build()

    return this.aggregation.aggregate<Pick<Item, "_id" | "type">>(pipeline)
  }

  async readRecommendationPosterCards(
    props: IReadEligibleRecommendationItemsProps,
  ) {
    const { ids, types } = props
    const eligibility = createRecommendationEligibilityPipeline(props)

    if (isNil(eligibility)) {
      return []
    }

    return this.readOrderedPosterCards(ids, { types, eligibility })
  }

  async readRecommendationCards(props: IReadEligibleRecommendationItemsProps) {
    const { ids, types } = props
    const eligibility = createRecommendationEligibilityPipeline(props, {
      ratingMode: "optional",
      isUserRatingIncluded: true,
    })

    if (isNil(eligibility)) {
      return []
    }

    return this.readOrderedPosterCards<IRecommendationCard>(ids, {
      types,
      eligibility,
      details: {
        ratingAverage: { $ifNull: ["$metrics.ratingAverage", null] },
        userRating: {
          $ifNull: [{ $arrayElemAt: ["$libraryEntry.rating", 0] }, null],
        },
        userStatus: {
          $ifNull: [{ $arrayElemAt: ["$libraryEntry.status", 0] }, null],
        },
      },
    })
  }

  private async readRecommendationItemIds(
    props: IReadPopularItemIdsProps,
    releaseWindow?: IItemReleaseWindow,
  ) {
    const { type, limit, siteRatingAverage } = props
    const isNew = !isUndefined(releaseWindow)
    const eligibility = createRecommendationEligibilityPipeline(props, {
      ratingMode: isNew ? "optional" : "required",
    })

    if (isNil(eligibility)) {
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
      .project(createRecommendationScoreProjection(priorWeight, baseline))
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

  private async readOrderedPosterCards<
    TCard extends IItemPosterCard = IItemPosterCard,
  >(
    ids: readonly Types.ObjectId[],
    options: {
      types?: readonly EItemType[]
      eligibility?: PipelineStage[]
      details?: PipelineStage.Project["$project"]
    } = {},
  ) {
    if (ids.length === 0) {
      return []
    }

    const { types, eligibility = [], details = {} } = options
    const builder = new AggregationBuilder().match({
      _id: { $in: ids },
      deletedAt: null,
    })

    if (!isUndefined(types)) {
      builder.match({ type: { $in: types } })
    }

    const pipeline = builder
      .use(...eligibility)
      .project(createPosterCardProjection(details))
      .build()
    const cards = await this.aggregation.aggregate<TCard>(pipeline)
    const cardsById = new Map(
      cards.map((card) => [card._id.toHexString(), card]),
    )

    return ids.flatMap((id) => {
      const card = cardsById.get(id.toHexString())

      return isUndefined(card) ? [] : [card]
    })
  }
}

export { ItemRepository }
