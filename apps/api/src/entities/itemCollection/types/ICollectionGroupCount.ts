import type { Types } from "mongoose"

interface ICollectionGroupCount {
  groupId: Types.ObjectId
  total: number
}

export type { ICollectionGroupCount }
