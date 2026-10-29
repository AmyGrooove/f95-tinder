import type { Types } from "mongoose"

interface IRemoveItemCollectionsProps {
  collectionId: Types.ObjectId
  itemIds: Types.ObjectId[]
  groupIds: Types.ObjectId[]
}

export type { IRemoveItemCollectionsProps }
