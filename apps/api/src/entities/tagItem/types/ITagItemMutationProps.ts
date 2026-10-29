import type { ClientSession, QueryFilter, Types } from "mongoose"

import type { TagItem } from "../schemas/tagItem.schema"

interface ITagItemMutationProps<TResult> {
  mutate: () => Promise<TResult>

  filters?: QueryFilter<TagItem>[]
  itemIds?: Types.ObjectId[]
  session?: ClientSession | null
  isPartialWritePossible?: boolean
}

export type { ITagItemMutationProps }
