import { ApiProperty } from "@nestjs/swagger"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { EUnit } from "@entities/shared/schemas/EUnit"

class CollectionCurrentAttemptResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: [EUserItemStatus.IN_PROGRESS, EUserItemStatus.ON_HOLD] })
  status: Exclude<
    EUserItemStatus,
    | EUserItemStatus.PLANNED
    | EUserItemStatus.COMPLETED
    | EUserItemStatus.DROPPED
  >

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  progress: number | null

  @ApiProperty({ enum: [EUnit.MINUTE] })
  unit: EUnit

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  startedAt: string | null
}

export { CollectionCurrentAttemptResponseDto }
