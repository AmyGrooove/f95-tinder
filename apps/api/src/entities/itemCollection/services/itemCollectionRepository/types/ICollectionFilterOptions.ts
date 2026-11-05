import type { Types } from "mongoose"

import type { Tag } from "@entities/tag/schemas/tag.schema"

import type { TCollectionFieldOptions } from "./TCollectionFieldOptions"

interface ICollectionFilterOptions {
  nonEmptyGroupIds: Types.ObjectId[]
  tags: Pick<Tag, "_id" | "key" | "group" | "name">[]
  fields: TCollectionFieldOptions[]
}

export type { ICollectionFilterOptions }
