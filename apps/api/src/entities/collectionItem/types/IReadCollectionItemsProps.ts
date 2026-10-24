import type { Types } from "mongoose"

import type { ICollectionContentSelectionProps } from "./ICollectionContentSelectionProps"
import type { TCollectionFeatureFilter } from "./TCollectionFeatureFilter"

interface IReadCollectionItemsProps extends ICollectionContentSelectionProps {
  isGrouped: boolean
  sort: "collection" | "title"
  direction: 1 | -1
  language: "ru" | "en"
  page: number
  limit: number
  tags: Types.ObjectId[]
  excludeTags: Types.ObjectId[]
  features: TCollectionFeatureFilter[]

  query?: string
  ratingMin?: number
  ratingMax?: number
}

export type { IReadCollectionItemsProps }
