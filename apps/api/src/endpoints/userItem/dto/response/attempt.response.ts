import { ApiProperty } from "@nestjs/swagger"

import { EUnit } from "@entities/shared/schemas/EUnit"

class AttemptResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: Boolean })
  isCompleted: boolean

  @ApiProperty({ type: Number, nullable: true, minimum: 0 })
  progress: number | null

  @ApiProperty({ enum: [EUnit.MINUTE, EUnit.PERCENT, EUnit.EPISODE] })
  unit: EUnit

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  startedAt: string | null

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  completedAt: string | null
}

export { AttemptResponseDto }
