import type { Types } from "mongoose"

interface ICollectionContentSelectionProps {
  collectionId: Types.ObjectId
  groupIds: Types.ObjectId[]

  groupId?: Types.ObjectId
}

export type { ICollectionContentSelectionProps }
