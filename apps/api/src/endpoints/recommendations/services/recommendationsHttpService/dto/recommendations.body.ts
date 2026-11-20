import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsObject, ValidateIf, ValidateNested } from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ValueFilterProperty } from "@entities/shared/decorators/ValueFilterProperty"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"

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

  @ApiPropertyOptional({ type: RecommendationsFilterDto })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsObject()
  @Type(() => RecommendationsFilterDto)
  @ValidateNested()
  filter?: RecommendationsFilterDto
}

export { RecommendationsBodyDto }
