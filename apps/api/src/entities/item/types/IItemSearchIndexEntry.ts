import type { Types } from "mongoose"

import type { Item } from "../schemas/item.schema"

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
  tagIds: Types.ObjectId[]
  rating: number | null
}

export type { IItemSearchIndexEntry }
