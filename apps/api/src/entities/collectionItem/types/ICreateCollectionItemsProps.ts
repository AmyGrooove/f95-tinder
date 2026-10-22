import type { Types } from "mongoose"

import type { TCreateCollectionItem } from "../schemas/collectionItem.schema"

interface ICreateCollectionItemsProps {
  collectionId: Types.ObjectId
  items: Omit<TCreateCollectionItem, "collection">[]
}

export type { ICreateCollectionItemsProps }
