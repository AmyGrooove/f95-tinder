import { ApiPropertyOptional, PickType } from "@nestjs/swagger"

import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"

class ProfileHistoryBodyDto extends PickType(QueryFieldsDto, [
  "limit",
  "cursor",
]) {
  @ApiPropertyOptional({ default: 20 })
  declare limit?: QueryFieldsDto["limit"]
}

export { ProfileHistoryBodyDto }
