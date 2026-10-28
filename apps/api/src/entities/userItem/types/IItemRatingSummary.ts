import type { Types } from "mongoose"
import type { RatingDistribution } from "@entities/itemMetric/schemas/ratingDistribution.schema"
import type { UserItemStatusCounts } from "@entities/itemMetric/schemas/userItemStatusCounts.schema"

interface IItemRatingSummary {
  _id: Types.ObjectId
  ratingAverage: number | null
  ratingsCount: number
  completedAttemptsCount: number
  ratingDistribution: RatingDistribution
  statusCounts: UserItemStatusCounts
  favoritesCount: number
}

export type { IItemRatingSummary }
