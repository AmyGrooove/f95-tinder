import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type {
  IReadRecommendationCandidatesProps,
  IRecommendationCandidateContext,
} from "@endpoints/recommendations/services/recommendationCandidatesService"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { FALLBACK_RECOMMENDATIONS_SETTINGS } from "../static/FALLBACK_RECOMMENDATIONS_SETTINGS"

@Injectable()
class FallbackRecommendationsService {
  constructor(
    private readonly candidatesService: RecommendationCandidatesService,
  ) {}

  async readItemIds(
    context: IRecommendationCandidateContext,
    props: Pick<IReadRecommendationCandidatesProps, "type" | "filter">,
  ) {
    const { maxItemsPerType, sourceOrder } = FALLBACK_RECOMMENDATIONS_SETTINGS
    const query = { ...props, limit: maxItemsPerType }
    const [popular, newReleases] = await Promise.all([
      this.candidatesService.readPopularItemIds(context, query),
      this.candidatesService.readNewItemIds(context, query),
    ])

    const sources = {
      popular: popular.values(),
      newReleases: newReleases.values(),
    }
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
      const source = sourceOrder[index % sourceOrder.length]
      const other = source === "popular" ? "newReleases" : "popular"
      const itemId = takeNext(sources[source]) ?? takeNext(sources[other])

      if (isUndefined(itemId)) {
        break
      }

      items.push(itemId)
    }

    return items
  }
}

export { FallbackRecommendationsService }
