import type { Feature } from "@entities/feature/schemas/feature.schema"
import type { ItemFeature } from "@entities/itemFeature/schemas/itemFeature.schema"
import type { ItemRelationRole } from "@entities/itemRelationRole/schemas/itemRelationRole.schema"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import type { Tag } from "@entities/tag/schemas/tag.schema"

import type { Item } from "../schemas/item.schema"

interface IItemDetails extends Pick<
  Item,
  "_id" | "type" | "title" | "description" | "aliases" | "media"
> {
  tags: Pick<Tag, "_id" | "key" | "group" | "name">[]
  features: (Pick<Feature, "_id" | "key" | "name" | "valueType" | "unit"> &
    Pick<ItemFeature, "value">)[]
  relations: {
    item: Pick<Item, "_id" | "type" | "title" | "media">
    role: Pick<ItemRelationRole, "_id" | "key" | "name">
    roleNameOverride: LanguageText
  }[]
}

export type { IItemDetails }
