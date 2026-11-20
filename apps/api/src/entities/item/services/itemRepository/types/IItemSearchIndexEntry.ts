import type { Types } from "mongoose"

import type { Tag } from "@entities/tag/schemas/tag.schema"

import type { Item } from "../../../schemas/item.schema"

interface IItemSearchIndexEntry extends Pick<
  Item,
  | "_id"
  | "type"
  | "title"
  | "aliases"
  | "description"
  | "media"
  | "releaseDate"
  | "ageRestriction"
  | "movie"
  | "series"
  | "game"
  | "deletedAt"
> {
  searchTags: (Pick<Tag, "group" | "key"> & { tag: Types.ObjectId })[]
  rating: number | null
  ratingsCount: number
}

export type { IItemSearchIndexEntry }
