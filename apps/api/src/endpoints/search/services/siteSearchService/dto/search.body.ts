import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsBoolean,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { ValueFilterProperty } from "@entities/shared/decorators/ValueFilterProperty"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"

import { ESearchGroup } from "../types/ESearchGroup"
import {
  SearchCollectionsBodyDto,
  SearchItemsBodyDto,
  SearchUsersBodyDto,
} from "./searchOptions.body"

const isProvided = (_object: unknown, value: unknown) => !isUndefined(value)

class SearchBodyDto extends PickType(QueryFieldsDto, [
  "search",
  "limit",
  "cursor",
]) {
  @ApiPropertyOptional({
    default: 20,
    description: SWAGGER_DICTIONARY.search.limit,
  })
  declare limit?: QueryFieldsDto["limit"]

  @ValueFilterProperty({ values: Object.values(ESearchGroup) })
  entities?: ValueFilter<ESearchGroup>

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: SWAGGER_DICTIONARY.search.isPersonalFilteringEnabled,
  })
  @ValidateIf(isProvided)
  @IsBoolean()
  isPersonalFilteringEnabled?: boolean

  @ApiPropertyOptional({ type: SearchItemsBodyDto })
  @ValidateIf(isProvided)
  @Type(() => SearchItemsBodyDto)
  @IsObject()
  @ValidateNested()
  items?: SearchItemsBodyDto

  @ApiPropertyOptional({ type: SearchCollectionsBodyDto })
  @ValidateIf(isProvided)
  @Type(() => SearchCollectionsBodyDto)
  @IsObject()
  @ValidateNested()
  collections?: SearchCollectionsBodyDto

  @ApiPropertyOptional({ type: SearchUsersBodyDto })
  @ValidateIf(isProvided)
  @Type(() => SearchUsersBodyDto)
  @IsObject()
  @ValidateNested()
  users?: SearchUsersBodyDto
}

export { SearchBodyDto }
