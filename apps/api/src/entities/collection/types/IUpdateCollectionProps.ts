import type { Types } from "mongoose"

import type { Collection } from "../schemas/collection.schema"

interface IUpdateCollectionProps {
  id: Types.ObjectId
  authorId: Types.ObjectId
  version: number
  changes: Pick<
    Collection,
    "title" | "description" | "media" | "type" | "blocks"
  >
}

export type { IUpdateCollectionProps }
