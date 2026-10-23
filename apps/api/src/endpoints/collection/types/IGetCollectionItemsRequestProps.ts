import type { Types } from "mongoose"

import type { CollectionItemsQueryDto } from "../dto/query/collectionItems.query"

interface IGetCollectionItemsRequestProps {
  id: Types.ObjectId
  query: CollectionItemsQueryDto
}

export type { IGetCollectionItemsRequestProps }
