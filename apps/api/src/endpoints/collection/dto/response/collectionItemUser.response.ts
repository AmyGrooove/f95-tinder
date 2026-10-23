import { ApiProperty } from "@nestjs/swagger"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

import { CollectionCurrentAttemptResponseDto } from "./collectionCurrentAttempt.response"

class CollectionItemUserResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EUserItemStatus })
  status: EUserItemStatus

  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  rating: number | null

  @ApiProperty({ type: Boolean })
  isFavorite: boolean

  @ApiProperty({ type: CollectionCurrentAttemptResponseDto, nullable: true })
  currentAttempt: CollectionCurrentAttemptResponseDto | null
}

export { CollectionItemUserResponseDto }
