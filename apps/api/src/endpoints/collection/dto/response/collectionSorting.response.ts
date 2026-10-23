import { ApiProperty } from "@nestjs/swagger"

import { ECollectionMode } from "../../types/ECollectionMode"

class CollectionSortingResponseDto {
  @ApiProperty({ enum: ECollectionMode, isArray: true, uniqueItems: true })
  availableModes: ECollectionMode[]
}

export { CollectionSortingResponseDto }
