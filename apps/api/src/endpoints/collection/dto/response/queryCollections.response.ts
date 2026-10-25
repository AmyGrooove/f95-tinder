import { ApiProperty } from "@nestjs/swagger"

import type { IPaginatedResult } from "@infrastructure/database/types/IPaginatedResult"

import { CollectionSummaryResponseDto } from "./collectionSummary.response"

class QueryCollectionsResponseDto implements IPaginatedResult<CollectionSummaryResponseDto> {
  @ApiProperty({ type: [CollectionSummaryResponseDto] })
  items: CollectionSummaryResponseDto[]

  @ApiProperty({ type: Number, minimum: 1 })
  page: number

  @ApiProperty({ type: Number, minimum: 1, maximum: 60 })
  limit: number

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
