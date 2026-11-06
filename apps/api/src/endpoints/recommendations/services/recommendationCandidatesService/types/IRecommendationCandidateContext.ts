import type { Types } from "mongoose"

import type { ECountry } from "@entities/shared/schemas/ECountry"

interface IRecommendationCandidateContext {
  userId: Types.ObjectId
  country: ECountry
  siteRatingAverage: number | null
}

export type { IRecommendationCandidateContext }
