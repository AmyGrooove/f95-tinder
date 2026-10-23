import type { CollectionBlock } from "@entities/collection/schemas/collectionBlock.schema"
import type { ICollectionGroupCount } from "@entities/collectionItem/types/ICollectionGroupCount"
import type { IPaginatedResult } from "@infrastructure/database/types/IPaginatedResult"

import type { CollectionItemResponseDto } from "../../../dto/response/collectionItem.response"

interface ICreateCollectionDisplayBlocksProps {
  blocks: CollectionBlock[]
  groupCounts: ICollectionGroupCount[]
  page: IPaginatedResult<CollectionItemResponseDto>
  isFiltered: boolean
}

export type { ICreateCollectionDisplayBlocksProps }
