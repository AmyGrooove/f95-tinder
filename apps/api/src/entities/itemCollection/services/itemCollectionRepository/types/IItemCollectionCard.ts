import type { Item } from "@entities/item/schemas/item.schema"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import type { IBriefUserItemProgress } from "@entities/userItem/types/IBriefUserItemProgress"

import type { ItemCollection } from "../../../schemas/itemCollection.schema"

interface IItemCollectionCard extends Pick<
  ItemCollection,
  "_id" | "groupId" | "position" | "note"
> {
  groupOrder: number
  item: Pick<Item, "_id" | "type" | "title" | "media">

  ratingAverage?: number | null
  viewerItem?: Pick<UserItem, "status" | "rating"> & {
    progress: IBriefUserItemProgress | null
  }
}

export type { IItemCollectionCard }
