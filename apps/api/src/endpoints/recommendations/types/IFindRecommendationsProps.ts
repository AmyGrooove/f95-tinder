import type { Types } from "mongoose"
import type { ECountry } from "@entities/shared/schemas/ECountry"

import type { IRecommendationFilter } from "@entities/item/types/IRecommendationFilter"
import type { IRecommendationLibrary } from "@entities/item/types/IRecommendationLibrary"

import type { IPagePagination } from "@infrastructure/database/types/IPaginationInput"

interface IFindRecommendationsProps {
  userId: Types.ObjectId

  filter?: IRecommendationFilter
  country?: ECountry
  library?: IRecommendationLibrary
  excludeItemIds?: readonly Types.ObjectId[]
  pagination?: IPagePagination
  candidateItemIds?: readonly Types.ObjectId[]
  isIncludingExcluded?: boolean
  direction?: "asc" | "desc"
}

export type { IFindRecommendationsProps }
