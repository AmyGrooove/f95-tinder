import type { Types } from "mongoose"

import type { TCreateItemCollection } from "../schemas/itemCollection.schema"

interface ICreateItemCollectionsProps {
  collectionId: Types.ObjectId
  items: Omit<TCreateItemCollection, "collectionId">[]
}

export type { ICreateItemCollectionsProps }
