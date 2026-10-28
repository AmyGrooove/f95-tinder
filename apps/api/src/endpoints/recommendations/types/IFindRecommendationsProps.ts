import type { Types } from "mongoose"

import type { IRecommendationFilter } from "@entities/item/types/IRecommendationFilter"
import type { IRecommendationLibrary } from "@entities/item/types/IRecommendationLibrary"

interface IFindRecommendationsProps {
  userId: Types.ObjectId

  filter?: IRecommendationFilter
  library?: IRecommendationLibrary
  excludeItemIds?: readonly Types.ObjectId[]
  pagination?: { page?: number; limit?: number }
  candidateItemIds?: readonly Types.ObjectId[]
  isIncludingExcluded?: boolean
  direction?: "asc" | "desc"
}

export type { IFindRecommendationsProps }
