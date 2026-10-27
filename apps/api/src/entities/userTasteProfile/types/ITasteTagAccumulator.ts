import type { Types } from "mongoose"

interface ITasteTagAccumulator {
  tag: Types.ObjectId
  total: number
  count: number
}

export type { ITasteTagAccumulator }
