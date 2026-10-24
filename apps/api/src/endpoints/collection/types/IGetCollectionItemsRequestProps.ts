import type { Types } from "mongoose"

import type { CollectionItemsBodyDto } from "../dto/body/collectionItems.body"

interface IGetCollectionItemsRequestProps {
  id: Types.ObjectId
  query: CollectionItemsBodyDto
}

export type { IGetCollectionItemsRequestProps }
