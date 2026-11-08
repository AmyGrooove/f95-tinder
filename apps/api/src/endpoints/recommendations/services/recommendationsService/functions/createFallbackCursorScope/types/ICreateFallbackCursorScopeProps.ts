import type { IRecommendationViewer } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import type { IFindRecommendationsProps } from "../../../types/IFindRecommendationsProps"

interface ICreateFallbackCursorScopeProps {
  viewer: IRecommendationViewer
  limit: TPageSize

  filter?: IFindRecommendationsProps["filter"]
}

export type { ICreateFallbackCursorScopeProps }
