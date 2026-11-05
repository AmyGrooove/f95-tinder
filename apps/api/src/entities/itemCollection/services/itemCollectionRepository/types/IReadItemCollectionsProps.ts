import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import type { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { Types } from "mongoose"

import type { ICollectionContentSelectionProps } from "./ICollectionContentSelectionProps"
import type { TItemFieldFilter } from "@entities/item/types/TItemFieldFilter"

interface IReadItemCollectionsProps extends ICollectionContentSelectionProps {
  isGrouped: boolean
  sort: "collection" | "title" | "relevanceScore"
  direction: 1 | -1
  language: ELanguage
  page: number
  limit: TPageSize
  tags: Types.ObjectId[]
  excludeTags: Types.ObjectId[]
  fields: TItemFieldFilter[]

  query?: string
  ratingMin?: number
  ratingMax?: number
}

export type { IReadItemCollectionsProps }
