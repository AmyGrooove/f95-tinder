import type { Types } from "mongoose"

import type { ECountry } from "@entities/shared/schemas/ECountry"

interface IRecommendationViewer {
  userId: Types.ObjectId
  country: ECountry
}

interface IRecommendationCandidateContext extends IRecommendationViewer {
  siteRatingAverage: number | null
}

export type { IRecommendationCandidateContext, IRecommendationViewer }
