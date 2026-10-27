import type { Types } from "mongoose"

interface IItemRatingSummary {
  _id: Types.ObjectId
  ratingAverage: number
  ratingsCount: number
}

export type { IItemRatingSummary }
