import type { CollectionBlock } from "@entities/collection/schemas/collectionBlock.schema"
import type { ICollectionGroupCount } from "@entities/itemCollection/types/ICollectionGroupCount"
import type { IPaginatedResult } from "@infrastructure/database/types/IPaginatedResult"

import type { ItemCollectionResponseDto } from "../../../dto/response/itemCollection.response"

interface ICreateCollectionDisplayBlocksProps {
  blocks: CollectionBlock[]
  groupCounts: ICollectionGroupCount[]
  page: IPaginatedResult<ItemCollectionResponseDto>
  isFiltered: boolean
}

export type { ICreateCollectionDisplayBlocksProps }
