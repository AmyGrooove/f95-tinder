import type { ItemRelationRole } from "@entities/itemRelationRole/schemas/itemRelationRole.schema"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { Tag } from "@entities/tag/schemas/tag.schema"

import type { Item } from "../schemas/item.schema"

interface IItemDetails extends Pick<
  Item,
  | "_id"
  | "type"
  | "title"
  | "description"
  | "aliases"
  | "media"
  | "releaseDate"
  | "ageRestriction"
  | "movie"
  | "series"
  | "game"
> {
  tags: Pick<Tag, "_id" | "key" | "group" | "name">[]
  relations: {
    item: Pick<Item, "_id" | "type" | "title" | "media">
    role: Pick<ItemRelationRole, "_id" | "key" | "name">
    roleNameOverride: LanguageText
  }[]
}

export type { IItemDetails }
