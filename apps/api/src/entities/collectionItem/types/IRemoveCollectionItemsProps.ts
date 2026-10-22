import type { Types } from "mongoose"

interface IRemoveCollectionItemsProps {
  collectionId: Types.ObjectId
  itemIds: Types.ObjectId[]
  groupIds: Types.ObjectId[]
}

export type { IRemoveCollectionItemsProps }
