import { ApiProperty } from "@nestjs/swagger"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { EUnit } from "@entities/shared/schemas/EUnit"

class AttemptResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({
    enum: [
      EUserItemStatus.IN_PROGRESS,
      EUserItemStatus.ON_HOLD,
      EUserItemStatus.COMPLETED,
      EUserItemStatus.DROPPED,
    ],
  })
  status: Exclude<EUserItemStatus, EUserItemStatus.PLANNED>

  @ApiProperty({ type: Number, nullable: true, minimum: 0 })
  progress: number | null

  @ApiProperty({ enum: [EUnit.MINUTE] })
  unit: EUnit

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  startedAt: string | null

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  completedAt: string | null
}

export { AttemptResponseDto }
