import type { Item } from "../schemas/item.schema"

interface IRecommendedItem extends Pick<
  Item,
  "_id" | "type" | "title" | "media"
> {
  tasteScore: number
  baseScore: number
  plannedBoost: number
  relationBoost: number
  finalScore: number
  ratingScore: number
}

export type { IRecommendedItem }
