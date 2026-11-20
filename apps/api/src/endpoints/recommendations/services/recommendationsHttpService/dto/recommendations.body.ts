import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ValueFilterProperty } from "@entities/shared/decorators/ValueFilterProperty"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { isString } from "@shared/functions/checks/isString"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { REGEX } from "@shared/static/REGEX"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"

const MAX_EXCLUDED_ITEMS = 25

class RecommendationsFilterDto extends PickType(QueryFieldsDto, [
  "types",
  "statuses",
]) {
  @ApiPropertyOptional({
    description: SWAGGER_DICTIONARY.recommendations.statuses,
  })
  declare statuses?: QueryFieldsDto["statuses"]

  @ValueFilterProperty({ maxGroups: 10 })
  tags?: ValueFilter<string>[]
}

class RecommendationsBodyDto extends PickType(QueryFieldsDto, [
  "limit",
  "cursor",
]) {
  @ApiPropertyOptional({ default: 20 })
  declare limit?: QueryFieldsDto["limit"]

  @ApiPropertyOptional({
    description: SWAGGER_DICTIONARY.recommendations.excludeItemIds,
    type: "array",
    items: { type: "string", pattern: REGEX.MONGO_OBJECT_ID.source },
    maxItems: MAX_EXCLUDED_ITEMS,
    uniqueItems: true,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsArray()
  @ArrayMaxSize(MAX_EXCLUDED_ITEMS)
  @ArrayUnique((value: unknown) =>
    isString(value) ? value.toLowerCase() : value,
  )
  @IsMongoId({ each: true })
  excludeItemIds?: string[]

  @ApiPropertyOptional({ type: RecommendationsFilterDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsObject()
  @Type(() => RecommendationsFilterDto)
  @ValidateNested()
  filter?: RecommendationsFilterDto
}

export { RecommendationsBodyDto }
