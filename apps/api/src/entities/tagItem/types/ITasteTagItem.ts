import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ETagGroup } from "@entities/tag/schemas/ETagGroup"

interface ITasteTagItem {
  item: Types.ObjectId
  tag: Types.ObjectId
  itemType: EItemType
  group: ETagGroup
  relevanceScore: number
}

export type { ITasteTagItem }
