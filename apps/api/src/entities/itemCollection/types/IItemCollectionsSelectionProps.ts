import type { Types } from "mongoose"

interface IItemCollectionsSelectionProps {
  collectionId: Types.ObjectId
  itemIds: Types.ObjectId[]
}

export type { IItemCollectionsSelectionProps }
