import { ApiPropertyOptional } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  Max,
  Min,
  ValidateIf,
} from "class-validator"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { isString } from "@shared/functions/checks/isString"

class QueryCollectionsBodyDto {
  @ApiPropertyOptional({
    type: [String],
    minItems: 1,
    maxItems: 60,
    uniqueItems: true,
    description: SWAGGER_DICTIONARY.collection.filterItems,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ArrayUnique((id: unknown) => (isString(id) ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  itemIds?: string[]

  @ApiPropertyOptional({ enum: ECollectionType })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(ECollectionType)
  type?: ECollectionType

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page?: number

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 60, default: 20 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number
}

export { QueryCollectionsBodyDto }
