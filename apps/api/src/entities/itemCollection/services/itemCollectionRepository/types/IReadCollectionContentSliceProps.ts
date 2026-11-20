import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { ESort } from "@entities/shared/types/ESort"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"

import type { ItemCollection } from "../../../schemas/itemCollection.schema"
import type { ICollectionContentSelectionProps } from "./ICollectionContentSelectionProps"

type TCollectionContentSort = ESort.TITLE | ESort.RELEASE_DATE | ESort.RATING

interface IReadCollectionContentSliceProps extends ICollectionContentSelectionProps {
  limit: number
  isPersonalFilterApplied: boolean
  isGrouped: boolean

  after?: {
    groupOrder: number
    position: number
    id: ItemCollection["_id"]
  }
  types?: readonly EItemType[]
  userId?: UserItem["user"]
  search?: string
  rating?: { min?: number; max?: number }
  sort?: {
    field: TCollectionContentSort
    direction: 1 | -1
    language: ELanguage
    offset: number
  }
}

export type { IReadCollectionContentSliceProps, TCollectionContentSort }
