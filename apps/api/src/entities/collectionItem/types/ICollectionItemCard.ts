import type { Item } from "@entities/item/schemas/item.schema"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import type { ItemAttempt } from "@entities/userItem/schemas/itemAttempt.schema"

import type { CollectionItem } from "../schemas/collectionItem.schema"

interface ICollectionItemCard extends Pick<
  CollectionItem,
  "groupId" | "position" | "note"
> {
  item: Pick<Item, "_id" | "type" | "title" | "media">

  userItem?:
    | (Pick<UserItem, "_id" | "status" | "rating" | "isFavorite"> & {
        currentAttempt: Pick<
          ItemAttempt,
          "id" | "isCompleted" | "progress" | "unit" | "startedAt"
        > | null
      })
    | null
}

export type { ICollectionItemCard }
