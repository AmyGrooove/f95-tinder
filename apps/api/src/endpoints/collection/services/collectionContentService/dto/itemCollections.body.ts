import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { IsBoolean, Matches, MaxLength, ValidateIf } from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { isUndefined } from "@shared/functions/checks/isUndefined"

const BASE64URL = /^[A-Za-z0-9_-]+$/

class ItemCollectionsBodyDto extends PickType(QueryFieldsDto, [
  "types",
  "limit",
  "cursor",
]) {
  @ApiPropertyOptional({ maxLength: 150, pattern: BASE64URL.source })
  @MaxLength(150)
  @Matches(BASE64URL)
  declare cursor?: string

  @ApiPropertyOptional({ default: 50 })
  declare limit?: QueryFieldsDto["limit"]

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: SWAGGER_DICTIONARY.collection.itemsPersonalFilters,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isPersonalFilteringEnabled?: boolean

  @ApiPropertyOptional({ type: Boolean, default: false })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isMetadataIncluded?: boolean
}

export { ItemCollectionsBodyDto }
