import { ApiProperty } from "@nestjs/swagger"

import type { IPagePaginationResult } from "@infrastructure/database/types/IPaginationResult"

import { CollectionSummaryResponseDto } from "./collectionSummary.response"

class QueryCollectionsResponseDto implements IPagePaginationResult<CollectionSummaryResponseDto> {
  @ApiProperty({ type: [CollectionSummaryResponseDto] })
  items: CollectionSummaryResponseDto[]

  @ApiProperty({ type: Number, minimum: 1 })
  page: number

  @ApiProperty({ type: Number, minimum: 0 })
  total: number

  @ApiProperty({ type: Number, minimum: 0 })
  pages: number

  @ApiProperty({ type: Boolean })
  isNextPage: boolean

  @ApiProperty({ type: Boolean })
  isPreviousPage: boolean
}

export { QueryCollectionsResponseDto }
