import type { Types } from "mongoose"

import type { ICollectionContentSelectionProps } from "./ICollectionContentSelectionProps"
import type { TCollectionFieldFilter } from "./TCollectionFieldFilter"

interface IReadCollectionItemsProps extends ICollectionContentSelectionProps {
  isGrouped: boolean
  sort: "collection" | "title" | "relevanceScore"
  direction: 1 | -1
  language: "ru" | "en"
  page: number
  limit: number
  tags: Types.ObjectId[]
  excludeTags: Types.ObjectId[]
  fields: TCollectionFieldFilter[]

  query?: string
  ratingMin?: number
  ratingMax?: number
}

export type { IReadCollectionItemsProps }
