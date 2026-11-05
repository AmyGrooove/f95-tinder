import type { Types } from "mongoose"

import type { EItemType } from "../schemas/EItemType"
import type { TItemFieldFilter } from "./TItemFieldFilter"

interface IItemFilter {
  types?: readonly EItemType[]
  tagIds?: readonly Types.ObjectId[]
  fields?: readonly TItemFieldFilter[]
  ratingMin?: number
  ratingMax?: number
}

export type { IItemFilter }
