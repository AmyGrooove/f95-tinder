import { ApiPropertyOptional, PickType } from "@nestjs/swagger"

import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"

class LibraryHistoryBodyDto extends PickType(QueryFieldsDto, [
  "limit",
  "cursor",
]) {
  @ApiPropertyOptional({ default: 20 })
  declare limit?: QueryFieldsDto["limit"]
}

export { LibraryHistoryBodyDto }
