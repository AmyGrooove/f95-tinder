import type { CollectionBlock } from "@entities/collection/schemas/collectionBlock.schema"
import type { ICollectionGroupCount } from "@entities/itemCollection/services/itemCollectionRepository"
import type { IPagePaginationResult } from "@infrastructure/database/types/IPaginationResult"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"

import type { ItemCollectionResponseDto } from "@endpoints/collection/dto/response/itemCollection.response"

interface ICreateCollectionDisplayBlocksProps {
  blocks: CollectionBlock[]
  groupCounts: ICollectionGroupCount[]
  page: IPagePaginationResult<ItemCollectionResponseDto>
  limit: TPageSize
  isFiltered: boolean
}

export type { ICreateCollectionDisplayBlocksProps }
