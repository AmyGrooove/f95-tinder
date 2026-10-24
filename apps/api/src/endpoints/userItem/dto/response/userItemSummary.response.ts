import { ApiProperty } from "@nestjs/swagger"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

class UserItemSummaryResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  itemId: string

  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 10 })
  rating: number | null

  @ApiProperty({ type: Boolean })
  isFavorite: boolean

  @ApiProperty({ enum: EUserItemStatus })
  status: EUserItemStatus
}

export { UserItemSummaryResponseDto }
