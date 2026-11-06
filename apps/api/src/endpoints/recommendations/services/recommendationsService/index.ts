export { RecommendationsService } from "./core/recommendations.service"
export { RecommendationCursorExpiredError } from "./errors/RecommendationCursorExpiredError"
export type { IFindRecommendationsProps } from "./types/IFindRecommendationsProps"
export type {
  IReadRecommendationCandidatesProps,
  IReadRecommendationCandidatesProps as IReadPopularRecommendationsProps,
} from "@endpoints/recommendations/services/recommendationCandidatesService"
export type { TFindRecommendationsResult } from "./types/TFindRecommendationsResult"
