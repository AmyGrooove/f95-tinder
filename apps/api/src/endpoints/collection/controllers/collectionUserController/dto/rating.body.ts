import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Max, Min, ValidateIf } from "class-validator"

import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

class RatingBodyDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  @ValidateIf(
    (_object: unknown, value: unknown) => isUndefined(value) || !isNil(value),
  )
  @IsInt()
  @Min(1)
  @Max(10)
  rating: number | null
}

export { RatingBodyDto }
