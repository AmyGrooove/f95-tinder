import type { Types } from "mongoose"

interface IRecommendationSourceCandidate {
  itemId: Types.ObjectId
  score: number

  bonus?: number
}

export type { IRecommendationSourceCandidate }
