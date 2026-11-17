import type { IRecommendationSourceCandidate } from "@endpoints/recommendations/services/fallbackRecommendationsService"
import type { IRecommendationCandidateContext } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { EItemType } from "@entities/item/schemas/EItemType"

interface IRecommendationFeedSources {
  plannedIds?: ReadonlySet<string>
  personalByType?: ReadonlyMap<
    EItemType,
    readonly IRecommendationSourceCandidate[]
  >
}

type TReadRecommendationFeedSources = (
  context: IRecommendationCandidateContext,
  types: readonly EItemType[],
) => Promise<IRecommendationFeedSources>

export type { IRecommendationFeedSources, TReadRecommendationFeedSources }
