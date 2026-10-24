import { ApiProperty } from "@nestjs/swagger"

import { EUnit } from "@entities/shared/schemas/EUnit"

class CollectionCurrentAttemptResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: Boolean })
  isCompleted: boolean

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  progress: number | null

  @ApiProperty({ enum: [EUnit.MINUTE, EUnit.PERCENT] })
  unit: EUnit

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  startedAt: string | null
}

export { CollectionCurrentAttemptResponseDto }
