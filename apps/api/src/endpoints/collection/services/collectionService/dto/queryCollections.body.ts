import { ApiPropertyOptional } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsMongoId,
  Max,
  Min,
  ValidateIf,
} from "class-validator"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import type { IPagePagination } from "@infrastructure/database/types/IPaginationInput"
import type { TPageSize } from "@infrastructure/database/types/TPageSize"
import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"

class QueryCollectionsBodyDto implements IPagePagination {
  @ApiPropertyOptional({
    type: [String],
    minItems: 1,
    maxItems: 60,
    uniqueItems: true,
    description: SWAGGER_DICTIONARY.collection.filterItems,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ArrayUnique((id: unknown) => (isString(id) ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  itemIds?: string[]

  @ApiPropertyOptional({ enum: ECollectionType })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsEnum(ECollectionType)
  type?: ECollectionType

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page?: number

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50], default: 50 })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsInt()
  @IsIn([10, 20, 50])
  limit?: TPageSize
}

export { QueryCollectionsBodyDto }
