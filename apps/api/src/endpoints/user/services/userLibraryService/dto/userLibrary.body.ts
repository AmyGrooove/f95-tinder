import {
  ApiPropertyOptional,
  IntersectionType,
  PickType,
} from "@nestjs/swagger"
import { IsBoolean, Matches, MaxLength, ValidateIf } from "class-validator"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import {
  MAX_CURSOR_LENGTH,
  QueryFieldsDto,
} from "@entities/shared/dto/query/queryFields.dto"
import { createSortDto } from "@entities/shared/functions/createSortDto"
import { LIBRARY_SORTS } from "@entities/userItem/static/LIBRARY_SORTS"
import { isUndefined } from "@shared/functions/checks/isUndefined"

class UserLibraryBodyDto extends IntersectionType(
  PickType(QueryFieldsDto, ["types", "statuses", "search", "limit", "cursor"]),
  createSortDto(LIBRARY_SORTS),
) {
  @ApiPropertyOptional({ default: 20 })
  declare limit?: QueryFieldsDto["limit"]

  @ApiPropertyOptional({
    pattern: "^[A-Za-z0-9_-]+$",
    description: SWAGGER_DICTIONARY.user.library.body.cursor,
  })
  @MaxLength(MAX_CURSOR_LENGTH)
  @Matches(/^[A-Za-z0-9_-]+$/)
  declare cursor?: string

  @ApiPropertyOptional({
    type: Boolean,
    description: SWAGGER_DICTIONARY.user.library.body.isFavorite,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isFavorite?: boolean

  @ApiPropertyOptional({
    type: Boolean,
    description: SWAGGER_DICTIONARY.user.library.body.isUnrated,
  })
  @ValidateIf((_object, value: unknown) => !isUndefined(value))
  @IsBoolean()
  isUnrated?: boolean
}

export { UserLibraryBodyDto }
