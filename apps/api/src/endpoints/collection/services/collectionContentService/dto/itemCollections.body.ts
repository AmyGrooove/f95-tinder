import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import {
  IsBoolean,
  IsEnum,
  IsIn,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ECollectionMode } from "@endpoints/collection/types/ECollectionMode"
import { ECollectionSort } from "@endpoints/collection/types/ECollectionSort"
import type { TCollectionContentSort } from "@entities/itemCollection/services/itemCollectionRepository"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { ESort } from "@entities/shared/types/ESort"
import { isUndefined } from "@shared/functions/checks/isUndefined"

const BASE64URL = /^[A-Za-z0-9_-]+$/
const COLLECTION_ITEM_SORTS = [
  ECollectionSort.COLLECTION,
  ESort.TITLE,
  ESort.RELEASE_DATE,
  ESort.RATING,
] as const

type TCollectionItemSort = ECollectionSort.COLLECTION | TCollectionContentSort

class ItemCollectionsBodyDto extends PickType(QueryFieldsDto, [
  "search",
  "rating",
  "types",
  "limit",
  "cursor",
  "direction",
  "language",
]) {
  @ApiPropertyOptional({ maxLength: 150, pattern: BASE64URL.source })
  @MaxLength(150)
  @Matches(BASE64URL)
  declare cursor?: string

  @ApiPropertyOptional({ default: 50 })
  declare limit?: QueryFieldsDto["limit"]

  @ApiPropertyOptional({
    enum: COLLECTION_ITEM_SORTS,
    default: ECollectionSort.COLLECTION,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsIn(COLLECTION_ITEM_SORTS)
  sort?: TCollectionItemSort

  @ApiPropertyOptional({
    enum: ECollectionMode,
    default: ECollectionMode.GROUPED,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsEnum(ECollectionMode)
  mode?: ECollectionMode

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: SWAGGER_DICTIONARY.collection.itemsPersonalFilters,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isPersonalFilteringEnabled?: boolean

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: SWAGGER_DICTIONARY.collection.itemsStatusFilter,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isItemStatusFilteringEnabled?: boolean

  @ApiPropertyOptional({ type: Boolean, default: false })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isMetadataIncluded?: boolean
}

export { ItemCollectionsBodyDto }
