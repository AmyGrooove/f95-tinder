import type { ClientSession, QueryFilter, Types } from "mongoose"

import type { ItemTag } from "../schemas/itemTag.schema"

interface IItemTagMutationProps<TResult> {
  mutate: () => Promise<TResult>

  filters?: QueryFilter<ItemTag>[]
  itemIds?: Types.ObjectId[]
  session?: ClientSession | null
  isPartialWritePossible?: boolean
}

export type { IItemTagMutationProps }
