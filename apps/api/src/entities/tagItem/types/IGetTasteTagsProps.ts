import type { Types } from "mongoose"

import type { ETagGroup } from "@entities/tag/schemas/ETagGroup"

interface IGetTasteTagsProps {
  itemIds: readonly Types.ObjectId[]
  groups: readonly ETagGroup[]
  tagIds: readonly Types.ObjectId[]
}

export type { IGetTasteTagsProps }
