import type { Types } from "mongoose"
import type { ETagGroup } from "@entities/tag/schemas/ETagGroup"

interface ICheckItemTagKeysProps {
  itemId: Types.ObjectId
  group: ETagGroup
  keys: readonly string[]
}

export type { ICheckItemTagKeysProps }
