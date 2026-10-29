import type { ClientSession, Types } from "mongoose"

import type { RatingDistribution } from "../schemas/ratingDistribution.schema"
import type { UserItemStatusCounts } from "../schemas/userItemStatusCounts.schema"

interface IUpdateItemMetricProps {
  itemId: Types.ObjectId
  ratingsCount: number
  favoritesCount: number
  completedAttemptsCount: number
  ratingDistribution: Partial<RatingDistribution>
  statusCounts: Partial<UserItemStatusCounts>
  session: ClientSession
}

export type { IUpdateItemMetricProps }
