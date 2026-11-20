import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsNumber, Max, Min, ValidateIf } from "class-validator"

import { isUndefined } from "@shared/functions/checks/isUndefined"

class RatingRangeDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsNumber()
  @Min(1)
  @Max(10)
  min?: number

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsNumber()
  @Min(1)
  @Max(10)
  max?: number
}

export { RatingRangeDto }
