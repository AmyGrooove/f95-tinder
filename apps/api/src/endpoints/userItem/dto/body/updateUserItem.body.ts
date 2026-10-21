import { ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator"

import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"

class UpdateUserItemBodyDto {
  @ApiPropertyOptional({ enum: EUserItemStatus })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(EUserItemStatus)
  status?: EUserItemStatus

  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  isFavorite?: boolean

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 10,
    nullable: true,
  })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  )
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number | null

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  note?: string | null
}

export { UpdateUserItemBodyDto }
