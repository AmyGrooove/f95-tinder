import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsBoolean, IsInt, Max, Min, ValidateIf } from "class-validator"

import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

class UpdateCollectionReactionBodyDto {
  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isFavorite?: boolean

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 10,
    nullable: true,
  })
  @ValidateIf((_object, value: unknown) => !isNil(value))
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null

  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isHidden?: boolean
}

export { UpdateCollectionReactionBodyDto }
