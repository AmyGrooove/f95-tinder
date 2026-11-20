import { ApiPropertyOptional, PickType } from "@nestjs/swagger"

import { ValueFilterProperty } from "@entities/shared/decorators/ValueFilterProperty"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"

class TagsBodyDto extends PickType(QueryFieldsDto, [
  "search",
  "limit",
  "cursor",
]) {
  @ApiPropertyOptional({ default: 50 })
  declare limit?: QueryFieldsDto["limit"]

  @ValueFilterProperty({ values: [...Object.values(ETagGroup), null] })
  groups?: ValueFilter<ETagGroup | null>
}

export { TagsBodyDto }
