import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsMongoId, IsOptional } from "class-validator"

import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"

class CollectionFiltersQueryDto {
  @ApiPropertyOptional({
    type: String,
    pattern: "^[a-fA-F0-9]{24}$",
    description: SWAGGER_DICTIONARY.collection.filterGroup,
  })
  @IsOptional()
  @IsMongoId()
  groupId?: string
}

export { CollectionFiltersQueryDto }
