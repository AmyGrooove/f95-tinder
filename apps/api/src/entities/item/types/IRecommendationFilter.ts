import type { Types } from "mongoose"

import type { EItemType } from "../schemas/EItemType"
import type { EItemField } from "../schemas/EItemField"

interface IRecommendationFilter {
  types?: readonly EItemType[]
  collectionId?: Types.ObjectId
  groupId?: Types.ObjectId
  tagIds?: readonly Types.ObjectId[]
  fields?: readonly {
    field: EItemField
    min?: number | Date
    max?: number | Date
  }[]
  ratingMin?: number
  ratingMax?: number
}

export type { IRecommendationFilter }
