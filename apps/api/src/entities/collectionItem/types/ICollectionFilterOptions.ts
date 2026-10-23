import type { Types } from "mongoose"

import type { Tag } from "@entities/tag/schemas/tag.schema"

import type { TCollectionFeatureOptions } from "./TCollectionFeatureOptions"

interface ICollectionFilterOptions {
  nonEmptyGroupIds: Types.ObjectId[]
  tags: Pick<Tag, "_id" | "key" | "group" | "name">[]
  features: TCollectionFeatureOptions[]
}

export type { ICollectionFilterOptions }
