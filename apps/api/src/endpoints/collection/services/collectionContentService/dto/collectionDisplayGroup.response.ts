import { ApiProperty } from "@nestjs/swagger"

import { GroupBlockResponseDto } from "@endpoints/collection/services/collectionService"

class CollectionDisplayGroupResponseDto extends GroupBlockResponseDto {
  @ApiProperty({ type: String })
  beforeItemId: string
}

export { CollectionDisplayGroupResponseDto }
