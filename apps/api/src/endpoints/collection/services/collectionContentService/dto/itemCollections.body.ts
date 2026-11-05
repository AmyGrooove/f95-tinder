import { ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"

class ItemCollectionsBodyDto {
  @ApiPropertyOptional({ type: String })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(150)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50], default: 50 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @IsIn([10, 20, 50])
  limit?: TPageSize
}

export { ItemCollectionsBodyDto }
