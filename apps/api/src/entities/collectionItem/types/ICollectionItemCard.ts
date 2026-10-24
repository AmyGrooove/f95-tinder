import type { Item } from "@entities/item/schemas/item.schema"

import type { CollectionItem } from "../schemas/collectionItem.schema"

interface ICollectionItemCard extends Pick<
  CollectionItem,
  "groupId" | "position" | "note"
> {
  item: Pick<Item, "_id" | "type" | "title" | "media">
}

export type { ICollectionItemCard }
