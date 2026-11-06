import type { Types } from "mongoose"

import type { IRecommendationCandidateFilter } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ICursorPagination } from "@infrastructure/database/types/IPaginationInput"

interface IRecommendationFilter extends IRecommendationCandidateFilter {
  types?: readonly EItemType[]
}

interface IFindRecommendationsProps extends ICursorPagination {
  sessionId: Types.ObjectId

  filter?: IRecommendationFilter
}

export type { IFindRecommendationsProps }
