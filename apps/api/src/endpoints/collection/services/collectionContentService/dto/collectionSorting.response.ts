import { ApiProperty } from "@nestjs/swagger"

import { ECollectionMode } from "@endpoints/collection/types/ECollectionMode"

class CollectionSortingResponseDto {
  @ApiProperty({ enum: ECollectionMode, isArray: true, uniqueItems: true })
  availableModes: ECollectionMode[]
}

export { CollectionSortingResponseDto }
