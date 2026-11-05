import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsBoolean, IsInt, Max, Min, ValidateIf } from "class-validator"

class UpdateCollectionReactionBodyDto {
  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isFavorite?: boolean

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 10,
    nullable: true,
  })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null

  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isHidden?: boolean
}

export { UpdateCollectionReactionBodyDto }
