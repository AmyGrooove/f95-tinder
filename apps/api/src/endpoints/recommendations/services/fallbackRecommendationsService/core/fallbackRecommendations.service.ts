import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type {
  IReadRecommendationCandidatesProps,
  IRecommendationCandidateContext,
} from "@endpoints/recommendations/services/recommendationCandidatesService"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { FALLBACK_RECOMMENDATIONS_SETTINGS } from "../static/FALLBACK_RECOMMENDATIONS_SETTINGS"
import { RECOMMENDATION_RANKING_SETTINGS } from "../../../static/RECOMMENDATION_RANKING_SETTINGS"
import type { IRecommendationSourceCandidate } from "../types/IRecommendationSourceCandidate"

@Injectable()
class FallbackRecommendationsService {
  constructor(
    private readonly candidatesService: RecommendationCandidatesService,
  ) {}

  async readItemIds(
    context: IRecommendationCandidateContext,
    props: Pick<IReadRecommendationCandidatesProps, "type" | "filter">,
    options: {
      personal?: readonly IRecommendationSourceCandidate[]
      plannedIds?: ReadonlySet<string>
    } = {},
  ) {
    const { personal = [], plannedIds = new Set<string>() } = options

    const { maxItemsPerType, sourceOrder, personalSourceOrder } =
      FALLBACK_RECOMMENDATIONS_SETTINGS
    const query = { ...props, limit: maxItemsPerType }
    const [popular, newReleases] = await Promise.all([
      this.candidatesService.readPopularItemIds(context, query),
      this.candidatesService.readNewItemIds(context, query),
    ])

    const { rankOffset, plannedBonus } = RECOMMENDATION_RANKING_SETTINGS
    const rankCandidates = (
      candidates: readonly IRecommendationSourceCandidate[],
    ) =>
      candidates
        .map((candidate) => {
          const { itemId, score, bonus = 0 } = candidate

          return {
            itemId,
            score:
              score *
              (1 +
                Math.max(
                  bonus,
                  plannedIds.has(itemId.toHexString()) ? plannedBonus : 0,
                )),
          }
        })
        .sort((left, right) => right.score - left.score)
        .map((candidate) => {
          const { itemId } = candidate

          return itemId
        })
    const rankBaseCandidates = (ids: Types.ObjectId[]) =>
      plannedIds.size === 0
        ? ids
        : rankCandidates(
            ids.map((itemId, index) => ({
              itemId,
              score: 1 / (rankOffset + index + 1),
            })),
          )
    const sources = {
      personal: rankCandidates(personal).values(),
      popular: rankBaseCandidates(popular).values(),
      newReleases: rankBaseCandidates(newReleases).values(),
    }
    const pattern = personal.length === 0 ? sourceOrder : personalSourceOrder
    const backupOrder =
      personal.length === 0
        ? (["popular", "newReleases"] as const)
        : (["personal", "newReleases", "popular"] as const)
    const seen = new Set<string>()
    const items: Types.ObjectId[] = []
    const takeNext = (source: IterableIterator<Types.ObjectId>) => {
      for (const itemId of source) {
        const key = itemId.toHexString()

        if (!seen.has(key)) {
          seen.add(key)

          return itemId
        }
      }

      return undefined
    }

    for (let index = 0; index < maxItemsPerType; index += 1) {
      const source = pattern[index % pattern.length]
      let itemId = takeNext(sources[source])

      for (const other of backupOrder) {
        if (!isUndefined(itemId)) {
          break
        }
        if (other !== source) {
          itemId = takeNext(sources[other])
        }
      }

      if (isUndefined(itemId)) {
        break
      }

      items.push(itemId)
    }

    return items
  }
}

export { FallbackRecommendationsService }
