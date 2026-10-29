import type { Item } from "@entities/item/schemas/item.schema"

import type { ItemCollection } from "../schemas/itemCollection.schema"

interface IItemCollectionCard extends Pick<
  ItemCollection,
  "groupId" | "position" | "note"
> {
  item: Pick<Item, "_id" | "type" | "title" | "media">
}

export type { IItemCollectionCard }
