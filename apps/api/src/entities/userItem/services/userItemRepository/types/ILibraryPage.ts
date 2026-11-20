import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { IItemPosterCard } from "@entities/item/services/itemRepository"
import type { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { EUnit } from "@entities/shared/schemas/EUnit"

import type { LIBRARY_SORTS } from "../../../static/LIBRARY_SORTS"
import type { TLibraryStatus } from "../../../types/TLibraryStatus"

interface IReadLibraryPageProps {
  userId: Types.ObjectId
  statuses: readonly TLibraryStatus[]
  types: readonly EItemType[]
  isProgressVisible: boolean
  sort: (typeof LIBRARY_SORTS)[number]
  direction: 1 | -1
  language: ELanguage
  offset: number
  limit: number

  search?: string
  isFavorite?: boolean
}

interface ILibraryEntry {
  _id: Types.ObjectId
  item: IItemPosterCard
  status: TLibraryStatus
  rating: number | null
  isFavorite: boolean
  ratingAverage: number | null
  progress: {
    value: number
    unit: EUnit.MINUTE | EUnit.EPISODE | EUnit.PERCENT
  } | null
}

export type { IReadLibraryPageProps, ILibraryEntry, TLibraryStatus }
