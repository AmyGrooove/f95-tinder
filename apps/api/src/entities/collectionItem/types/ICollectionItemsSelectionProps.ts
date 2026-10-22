import type { Types } from "mongoose"

interface ICollectionItemsSelectionProps {
  collectionId: Types.ObjectId
  itemIds: Types.ObjectId[]
}

export type { ICollectionItemsSelectionProps }
