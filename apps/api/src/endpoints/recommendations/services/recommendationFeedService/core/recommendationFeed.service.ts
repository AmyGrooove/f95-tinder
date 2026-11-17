import { Injectable, Logger } from "@nestjs/common"
import { Types } from "mongoose"

import type { IRecommendationCandidateContext } from "@endpoints/recommendations/services/recommendationCandidatesService"
import {
  RecommendationsService,
  calculateAlsCandidates,
  calculateItemCfCandidates,
} from "@endpoints/recommendations/services/recommendationsService"
import type {
  IFindRecommendationsProps,
  IRecommendationFeedSources,
} from "@endpoints/recommendations/services/recommendationsService"
import type { EItemType } from "@entities/item/schemas/EItemType"
import {
  ItemRepository,
  resolveRecommendationLibraryStatuses,
} from "@entities/item/services/itemRepository"
import { ItemRelationRepository } from "@entities/itemRelation/services/itemRelationRepository"
import { RelationRepository } from "@entities/relation/services/relationRepository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItemRepository } from "@entities/userItem/services/userItemRepository"
import { isNil } from "@shared/functions/checks/isNil"

import { RECOMMENDATION_RANKING_SETTINGS } from "../../../static/RECOMMENDATION_RANKING_SETTINGS"

@Injectable()
class RecommendationFeedService {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly userItemRepository: UserItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly itemRelationRepository: ItemRelationRepository,
    private readonly relationRepository: RelationRepository,
  ) {}

  readPage(
    accessToken: unknown,
    props: Pick<IFindRecommendationsProps, "cursor" | "filter" | "limit"> = {},
  ) {
    return this.recommendationsService.readFeedPage(
      accessToken,
      props,
      (context, types) => this.readSources(context, types, props.filter),
    )
  }

  private async readSources(
    context: IRecommendationCandidateContext,
    types: readonly EItemType[],
    filter: IFindRecommendationsProps["filter"],
  ): Promise<IRecommendationFeedSources> {
    const { userId, country } = context
    const libraryStatuses = resolveRecommendationLibraryStatuses(
      filter?.library,
    )
    if (types.length === 0 || libraryStatuses.length === 0) {
      return {}
    }

    const { PLANNED, SKIPPED } = EUserItemStatus
    const isPlannedBonusEnabled =
      libraryStatuses.length > 1 && libraryStatuses.includes(PLANNED)
    const projection = { _id: 0, item: 1 } as const
    const [interactions, planned] = await Promise.all([
      this.userItemRepository.read.findMany(
        {
          user: userId,
          status: { $ne: SKIPPED },
          $or: [
            { rating: { $gte: 8, $lte: 10 } },
            { isFavorite: true, rating: null },
            { isFavorite: true, rating: { $gte: 5, $lte: 10 } },
          ],
        },
        projection,
        { lean: true },
      ),
      isPlannedBonusEnabled
        ? this.userItemRepository.read.findMany(
            { user: userId, status: PLANNED },
            projection,
            { lean: true },
          )
        : [],
    ])
    const plannedIds = new Set(planned.map(({ item }) => item.toHexString()))
    const positiveIds = new Map(
      interactions.map(({ item }) => [item.toHexString(), item]),
    )
    const {
      minPositiveItems,
      rankOffset,
      algorithmWeight,
      algorithmCandidatesPerType,
      sequelBonus,
    } = RECOMMENDATION_RANKING_SETTINGS

    if (positiveIds.size < minPositiveItems) {
      return { plannedIds }
    }

    const [model, positiveItems] = await Promise.all([
      this.recommendationsService.loadLatestModel({
        isInvalidModelIgnored: true,
      }),
      this.itemRepository.findNotDeletedByIds([...positiveIds.values()]),
    ])
    if (isNil(model)) {
      return { plannedIds }
    }

    const modelIds = new Set(model.itemIds)
    const knownPositiveIds = positiveItems
      .map(({ _id }) => _id.toHexString())
      .filter((id) => modelIds.has(id))
    if (knownPositiveIds.length < minPositiveItems) {
      return { plannedIds }
    }

    const scoreOptions = { isPositiveCandidateAllowed: true }
    let als: ReturnType<typeof calculateAlsCandidates>
    try {
      als = calculateAlsCandidates(model, knownPositiveIds, scoreOptions)
    } catch (error) {
      Logger.warn(error, RecommendationFeedService.name)
      return { plannedIds }
    }

    const itemCf = calculateItemCfCandidates(
      model,
      knownPositiveIds,
      scoreOptions,
    )
    const eligibleItems =
      await this.itemRepository.readEligibleRecommendationItems({
        ...filter,
        userId,
        country,
        types,
        ids: model.itemIds
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      })
    const typeById = new Map(
      eligibleItems.map(({ _id, type }) => [_id.toHexString(), type]),
    )
    const scoresByType = new Map(
      types.map((type) => {
        const scores = new Map<string, number>()
        for (const ranking of [itemCf, als]) {
          let rank = 0

          for (const { itemId } of ranking) {
            if (typeById.get(itemId) !== type) {
              continue
            }

            rank += 1
            scores.set(
              itemId,
              (scores.get(itemId) ?? 0) + algorithmWeight / (rankOffset + rank),
            )
            if (rank === algorithmCandidatesPerType) {
              break
            }
          }
        }

        return [type, scores]
      }),
    )

    const personalIds = [...scoresByType.values()].flatMap((scores) =>
      [...scores.keys()].map((id) => new Types.ObjectId(id)),
    )
    const sequelIds = await this.readSequelIds(
      context,
      positiveItems.map(({ _id }) => _id),
      personalIds,
    )
    const personalByType = new Map(
      [...scoresByType].map(([type, scores]) => [
        type,
        [...scores]
          .sort(([leftId, left], [rightId, right]) =>
            left === right ? leftId.localeCompare(rightId) : right - left,
          )
          .map(([id, score]) => ({
            itemId: new Types.ObjectId(id),
            score,
            bonus: sequelIds.has(id) ? sequelBonus : 0,
          })),
      ]),
    )

    return { plannedIds, personalByType }
  }

  private async readSequelIds(
    { userId, country }: IRecommendationCandidateContext,
    positiveIds: readonly Types.ObjectId[],
    candidateIds: readonly Types.ObjectId[],
  ) {
    if (candidateIds.length === 0) {
      return new Set<string>()
    }

    const role = await this.relationRepository.read.findOne(
      { key: "sequel" },
      { _id: 1 },
      { lean: true },
    )
    if (isNil(role)) {
      return new Set<string>()
    }

    const sources = await this.itemRepository.readEligibleRecommendationItems({
      userId,
      country,
      ids: positiveIds,
      library: {},
    })

    return sources.length === 0
      ? new Set<string>()
      : this.itemRelationRepository.readRelatedItemIds(
          sources.map(({ _id }) => _id),
          candidateIds,
          role._id,
        )
  }
}

export { RecommendationFeedService }
