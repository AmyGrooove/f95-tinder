import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { isArray } from "@shared/functions/checks/isArray"

class LibraryContinueBodyDto extends PickType(QueryFieldsDto, ["types"]) {
  @ApiPropertyOptional({
    uniqueItems: false,
    description: SWAGGER_DICTIONARY.account.dto.libraryContinueBody.types,
  })
  @Transform((params: TransformFnParams) => {
    const { value } = params

    return isArray(value) ? [...new Set(value)] : value
  })
  declare types?: QueryFieldsDto["types"]
}

export { LibraryContinueBodyDto }
