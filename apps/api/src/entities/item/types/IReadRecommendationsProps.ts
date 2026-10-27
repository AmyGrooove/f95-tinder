import type { Types } from "mongoose"

import type { TasteTagPreference } from "@entities/userTasteProfile/schemas/tasteTagPreference.schema"

import type { IRecommendationFilter } from "./IRecommendationFilter"
import type { IRecommendationLibrary } from "./IRecommendationLibrary"

interface IReadRecommendationsProps {
  userId: Types.ObjectId
  preferences: readonly TasteTagPreference[]
  siteRatingAverage: number | null
  now: Date
  page: number
  limit: number

  filter?: IRecommendationFilter
  library?: IRecommendationLibrary
  excludeItemIds?: readonly Types.ObjectId[]
  collectionGroupIds?: readonly Types.ObjectId[]
}

export type { IReadRecommendationsProps }
