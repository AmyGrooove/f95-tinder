import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsIn, IsInt, IsISO8601, Min, Max, ValidateIf } from "class-validator"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { EUnit } from "@entities/shared/schemas/EUnit"

class CreateAttemptBodyDto {
  @ApiProperty({
    enum: [
      EUserItemStatus.IN_PROGRESS,
      EUserItemStatus.ON_HOLD,
      EUserItemStatus.COMPLETED,
      EUserItemStatus.DROPPED,
    ],
  })
  @IsIn([
    EUserItemStatus.IN_PROGRESS,
    EUserItemStatus.ON_HOLD,
    EUserItemStatus.COMPLETED,
    EUserItemStatus.DROPPED,
  ])
  status: Exclude<EUserItemStatus, EUserItemStatus.PLANNED>

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    nullable: true,
  })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  )
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  progress?: number | null

  @ApiPropertyOptional({ enum: [EUnit.MINUTE], default: EUnit.MINUTE })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsIn([EUnit.MINUTE])
  unit?: EUnit.MINUTE

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  )
  @IsISO8601({ strict: true, strictSeparator: true })
  startedAt?: string | null

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  )
  @IsISO8601({ strict: true, strictSeparator: true })
  completedAt?: string | null
}

export { CreateAttemptBodyDto }
