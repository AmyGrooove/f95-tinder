import { ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  Min,
  Max,
  ValidateIf,
} from "class-validator"

import { EUnit } from "@entities/shared/schemas/EUnit"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

class CreateAttemptBodyDto {
  @ApiPropertyOptional({ type: Boolean, default: false })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isCompleted?: boolean

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    nullable: true,
  })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  progress?: number | null

  @ApiPropertyOptional({
    enum: [EUnit.MINUTE, EUnit.PERCENT],
    default: EUnit.MINUTE,
  })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsIn([EUnit.MINUTE, EUnit.PERCENT])
  unit?: EUnit.MINUTE | EUnit.PERCENT

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsISO8601({ strict: true, strictSeparator: true })
  startedAt?: string | null

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsISO8601({ strict: true, strictSeparator: true })
  completedAt?: string | null
}

export { CreateAttemptBodyDto }
